const mongoose = require("mongoose");

const Agent = require("../models/Agent");
const Customer = require("../models/Customer");
const CustomerCart = require("../models/CustomerCart");
const CustomerPricing = require("../models/CustomerPricing");
const CustomerSurge = require("../models/CustomerSurge");
const Merchant = require("../models/Merchant");
const MerchantDiscount = require("../models/MerchantDiscount");
const PickAndCustomCart = require("../models/PickAndCustomCart");
const Product = require("../models/Product");
const appError = require("./appError");

const { convertISTToUTC } = require("./formatters");

const geoLocation = require("./getGeoLocation");

const {
  calculateDeliveryCharges,
  getTaxAmount,
  getDistanceFromPickupToDelivery,
  filterProductIdAndQuantity,
} = require("./customerAppHelpers");

// Create or return the existing customer
const findOrCreateCustomer = async ({
  customerId,
  newCustomer,
  customerAddress,
  deliveryMode,
  formattedErrors,
}) => {
  if (customerId) {
    const customer = await Customer.findById(customerId);
    if (!customer) throw new Error("Customer not found");
    return customer;
  }

  const existingCustomer = await Customer.findOne({
    $or: [
      { phoneNumber: newCustomer?.phoneNumber },
      { email: newCustomer?.email },
    ],
  });

  if (existingCustomer) return existingCustomer;

  if (newCustomer && deliveryMode === "Take Away") {
    const customer = await Customer.create({
      fullName: newCustomer?.fullName,
      email: newCustomer?.email,
      phoneNumber: newCustomer?.phoneNumber,
      customerDetails: {
        isBlocked: false,
      },
    });

    return customer;
  }

  if (customerAddress) {
    const location = [customerAddress?.latitude, customerAddress?.longitude];
    const updatedAddress = {
      fullName: customerAddress?.fullName,
      phoneNumber: customerAddress?.phoneNumber,
      flat: customerAddress?.flat,
      area: customerAddress?.area,
      landmark: customerAddress?.landmark,
      coordinates: location,
    };

    const geofence = await geoLocation(
      customerAddress?.latitude,
      customerAddress?.longitude
    );

    if (!geofence) {
      return { message: "User coordinates are outside defined geofences" };
    }

    const updatedNewCustomer = {
      fullName: newCustomer.fullName,
      email: newCustomer.email,
      phoneNumber: newCustomer.phoneNumber,
      customerDetails: {
        location,
        geofenceId: geofence._id,
        homeAddress:
          customerAddress.addressType === "home" ? updatedAddress : null,
        workAddress:
          customerAddress.addressType === "work" ? updatedAddress : null,
        otherAddress:
          customerAddress.addressType === "other" ? [updatedAddress] : [],
      },
    };

    return await Customer.create(updatedNewCustomer);
  }
};

// Get the scheduled details
const processSchedule = (ifScheduled) => {
  const { startDate, endDate } = ifScheduled;
  const time = ifScheduled.time
    ? convertISTToUTC(startDate, ifScheduled.time)
    : null;

  if (!startDate || !endDate || !time) {
    return { startDate: null, endDate: null, time: null, numOfDays: null };
  }

  const adjustedStartDate = new Date(startDate);
  adjustedStartDate.setUTCDate(adjustedStartDate.getUTCDate() - 1);
  adjustedStartDate.setUTCHours(18, 30, 0, 0);

  const adjustedTime = new Date(time);
  adjustedTime.setUTCHours(adjustedTime.getUTCHours() - 1);

  const adjustedEndDate = new Date(endDate);
  adjustedEndDate.setUTCHours(18, 29, 59, 999);

  const numOfDays = getTotalDaysBetweenDates(
    adjustedStartDate,
    adjustedEndDate
  );

  return {
    startDate: adjustedStartDate,
    endDate: adjustedEndDate,
    time: adjustedTime,
    numOfDays,
  };
};

// Calculate the item total in cart
const calculateItemTotal = (items, numOfDays) => {
  const calculatedTotal = items
    .reduce((total, item) => total + item.price * item.quantity, 0)
    .toFixed(2);
  return numOfDays ? (calculatedTotal * numOfDays).toFixed(2) : calculatedTotal;
};

// Calculate the total weight of items
const getTotalItemWeight = (deliveryMode, items) => {
  let weight = 0;

  if (deliveryMode === "Pick and Drop" || deliveryMode === "Custom Order") {
    weight = items.reduce((total, item) => {
      if (item.unit === "kg") {
        return total + parseFloat(item.quantity * item.numOfUnits);
      } else {
        return total + parseFloat(item.weight || 0);
      }
    }, 0);
  }

  return weight.toFixed(2);
};

// Calculate additional weight charge
const calculateAdditionalWeightCharge = (
  totalWeight,
  baseWeight,
  fareAfterBaseWeight
) => {
  const weightDifference = totalWeight - baseWeight;

  if (weightDifference > 0) {
    return parseFloat(
      (weightDifference * parseFloat(fareAfterBaseWeight)).toFixed(2)
    );
  }

  return 0;
};

// Calculate the subTotal in cart
const calculateSubTotal = ({
  itemTotal,
  surgeCharge = 0,
  deliveryCharge,
  addedTip = 0,
  totalDiscountAmount = 0,
}) => {
  const total = parseFloat(itemTotal) || 0;
  const surge = parseFloat(surgeCharge) || 0;
  const delivery = parseFloat(deliveryCharge) || 0;
  const tip = parseFloat(addedTip) || 0;
  const discount = parseFloat(totalDiscountAmount) || 0;

  return (total + surge + delivery + tip - discount).toFixed(2);
};

// Calculate the grandTotal of cart
const calculateGrandTotal = ({
  itemTotal,
  surgeCharges = 0,
  deliveryCharge,
  addedTip = 0,
  taxAmount,
}) => {
  const total = [
    parseFloat(itemTotal) || 0,
    parseFloat(surgeCharges) || 0,
    parseFloat(deliveryCharge) || 0,
    parseFloat(addedTip) || 0,
    parseFloat(taxAmount) || 0,
  ].reduce((acc, curr) => acc + curr, 0);

  return Number(total.toFixed(2));
};

// Get the number of days between scheduled dates
const getTotalDaysBetweenDates = (startDate, endDate) =>
  Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

// Function for formatting items in the response
const formattedCartItems = async (cart) => {
  const populatedCart = cart.toObject();

  // Populate the product details for each item
  const productIds = populatedCart.items.map((item) => item.productId);
  const products = await Product.find({ _id: { $in: productIds } }).lean();

  const productMap = new Map(
    products.map((product) => [product._id.toString(), product])
  ); // Create a map for quick access

  populatedCart.items = populatedCart.items.map((item) => {
    const product = productMap.get(item.productId.toString());
    let variantTypeData = null;

    if (item.variantTypeId && product?.variants) {
      const variantType = product.variants
        .flatMap((variant) => variant.variantTypes)
        .find((type) => type._id.equals(item.variantTypeId));

      if (variantType) {
        variantTypeData = {
          _id: variantType._id,
          variantTypeName: variantType.typeName,
        };
      }
    }

    return {
      ...item,
      productId: {
        _id: product._id,
        productName: product.productName,
        description: product.description,
        productImageURL: product.productImageURL,
      },
      variantTypeId: variantTypeData,
    };
  });

  return populatedCart;
};

// Helper function to update customer address
const updateCustomerAddress = async (
  addressType,
  newAddress,
  customer,
  customerAddressOtherAddressId
) => {
  const location = [newAddress.latitude, newAddress.longitude];
  newAddress.coordinates = location;

  switch (addressType) {
    case "home":
      customer.customerDetails.homeAddress = newAddress;
      break;
    case "work":
      customer.customerDetails.workAddress = newAddress;
      break;
    case "other":
      const otherIndex = customer.customerDetails.otherAddress.findIndex(
        (addr) => addr.id.toString() === customerAddressOtherAddressId
      );

      if (otherIndex !== -1) {
        customer.customerDetails.otherAddress[otherIndex] = newAddress;
      } else {
        customer.customerDetails.otherAddress.push(newAddress);
      }
      break;
    default:
      throw new Error("Invalid address type");
  }

  await customer.save();
  return location;
};

// Helper function to retrieve address details based on type
const getAddressDetails = (customer, addressType, addressId) => {
  switch (addressType) {
    case "home":
      return customer.customerDetails.homeAddress || null;
    case "work":
      return customer.customerDetails.workAddress || null;
    case "other":
      return (
        customer.customerDetails.otherAddress.find(
          (addr) => addr.id.toString() === addressId
        ) || null
      );
    default:
      return null;
  }
};

// Main function to handle address details
const handleAddressDetails = async (
  deliveryMode,
  customer,
  customerAddressType,
  customerAddressOtherAddressId,
  newCustomer,
  newCustomerAddress,
  merchantFound,
  pickUpAddressType,
  pickUpAddressOtherAddressId,
  deliveryAddressType,
  deliveryAddressOtherAddressId,
  newPickupAddress,
  newDeliveryAddress,
  customPickupLocation
) => {
  let pickupLocation, pickupAddress, deliveryLocation, deliveryAddress;

  const merchantLocation = merchantFound?.merchantDetail?.location;
  const merchantInfo = {
    fullName: merchantFound?.merchantDetail?.merchantName,
    area: merchantFound?.merchantDetail?.displayAddress,
    phoneNumber: merchantFound?.phoneNumber,
  };

  // Set pickup and delivery details for "Take Away"
  if (deliveryMode === "Take Away") {
    pickupLocation = deliveryLocation = merchantLocation;
    pickupAddress = deliveryAddress = merchantInfo;
    return { pickupLocation, pickupAddress, deliveryLocation, deliveryAddress };
  }

  // Set pickup details for "Home Delivery"
  if (deliveryMode === "Home Delivery") {
    pickupLocation = merchantLocation;
    pickupAddress = merchantInfo;

    if (newCustomer) {
      deliveryLocation = [
        newCustomerAddress.latitude,
        newCustomerAddress.longitude,
      ];
      deliveryAddress = newCustomerAddress;
    }

    if (newCustomerAddress) {
      deliveryLocation = [
        newCustomerAddress.latitude,
        newCustomerAddress.longitude,
      ];
      deliveryAddress = newCustomerAddress;

      if (newCustomerAddress.saveAddress) {
        await updateCustomerAddress(
          newCustomerAddress.type,
          newCustomerAddress,
          customer,
          customerAddressOtherAddressId
        );
      }
    }

    if (customerAddressType) {
      const address = getAddressDetails(
        customer,
        customerAddressType,
        customerAddressOtherAddressId
      );

      if (!address) throw new Error("Address not found");
      deliveryLocation = address.coordinates;
      deliveryAddress = address;
    }
  }

  // Set pickup and delivery details for "Pick and Drop"
  if (deliveryMode === "Pick and Drop") {
    if (newPickupAddress) {
      pickupLocation = [newPickupAddress.latitude, newPickupAddress.longitude];
      pickupAddress = newPickupAddress;
      if (newPickupAddress.saveAddress) {
        await updateCustomerAddress(
          newPickupAddress.type,
          newPickupAddress,
          customer,
          deliveryAddressOtherAddressId
        );
      }
    }

    if (pickUpAddressType) {
      const address = getAddressDetails(
        customer,
        pickUpAddressType,
        pickUpAddressOtherAddressId
      );

      if (!address) throw new Error("Pickup address not found");
      pickupLocation = address.coordinates;
      pickupAddress = address;
    }

    if (newDeliveryAddress) {
      deliveryLocation = [
        newDeliveryAddress.latitude,
        newDeliveryAddress.longitude,
      ];
      deliveryAddress = newDeliveryAddress;
      if (newDeliveryAddress.saveAddress) {
        await updateCustomerAddress(
          newDeliveryAddress.type,
          newDeliveryAddress,
          customer,
          customerAddressOtherAddressId
        );
      }
    }

    if (deliveryAddressType) {
      const address = getAddressDetails(
        customer,
        deliveryAddressType,
        customerAddressOtherAddressId || deliveryAddressOtherAddressId
      );

      if (!address) throw new Error("Delivery address not found");
      deliveryLocation = address.coordinates;
      deliveryAddress = address;
    }
  }

  // Handle "Custom Order"
  if (deliveryMode === "Custom Order") {
    if (
      Array.isArray(customPickupLocation) &&
      customPickupLocation.every(
        (coord) => coord !== null && coord !== undefined
      )
    ) {
      pickupLocation = [...customPickupLocation];
    } else {
      pickupLocation = [];
    }

    if (newDeliveryAddress) {
      deliveryLocation = [
        newDeliveryAddress.latitude,
        newDeliveryAddress.longitude,
      ];
      deliveryAddress = newDeliveryAddress;

      if (newDeliveryAddress.saveAddress) {
        await updateCustomerAddress(
          deliveryAddressType || newDeliveryAddress.type,
          newDeliveryAddress,
          customer,
          deliveryAddressOtherAddressId
        );
      }
    }

    if (deliveryAddressType) {
      const address = getAddressDetails(
        customer,
        deliveryAddressType,
        deliveryAddressOtherAddressId
      );
      if (!address) throw new Error("Delivery address not found");
      deliveryLocation = address.coordinates;
      deliveryAddress = address;
    }
  }

  // Validate required details for Home Delivery and Pick and Drop
  if (
    (deliveryMode === "Home Delivery" || deliveryMode === "Pick and Drop") &&
    (!pickupLocation || !pickupAddress || !deliveryLocation || !deliveryAddress)
  ) {
    throw new Error("Incomplete address details");
  }

  return { pickupLocation, pickupAddress, deliveryLocation, deliveryAddress };
};

// Helper function to process scheduled delivery
const processScheduledDelivery = (deliveryOption, req) => {
  if (deliveryOption === "Scheduled") {
    return processSchedule(req.body.ifScheduled);
  }
  return {};
};

// Handle home delivery mode logic
const handleDeliveryMode = async (
  deliveryMode,
  customer,
  customerAddressType,
  customerAddressOtherAddressId,
  newCustomer,
  newCustomerAddress,
  merchant
) => {
  const addressDetails = await handleAddressDetails(
    deliveryMode,
    customer,
    customerAddressType,
    customerAddressOtherAddressId,
    newCustomer,
    newCustomerAddress,
    merchant
  );

  let distance = 0;

  // Calculate distance only if the delivery mode is not "Take Away"
  if (deliveryMode !== "Take Away") {
    const { distanceInKM } = await getDistanceFromPickupToDelivery(
      merchant.merchantDetail.location,
      addressDetails.deliveryLocation
    );
    distance = distanceInKM;
  }

  return {
    ...addressDetails,
    distanceInKM: distance,
  };
};

// Function to calculate delivery charges
const calculateDeliveryChargesHelper = async (
  deliveryMode,
  distanceInKM,
  merchantFound,
  customer,
  items,
  scheduledDetails,
  selectedBusinessCategory
) => {
  let oneTimeDeliveryCharge = null;
  let surgeCharges = null;
  let deliveryChargeForScheduledOrder = null;
  let taxAmount = null;

  const itemTotal = calculateItemTotal(items, scheduledDetails?.numOfDays);

  if (deliveryMode === "Home Delivery") {
    const businessCategoryId = selectedBusinessCategory;

    if (!businessCategoryId) throw new Error("Business category not found");

    const customerPricing = await CustomerPricing.findOne({
      deliveryMode,
      businessCategoryId,
      geofenceId: customer.customerDetails.geofenceId,
      status: true,
    });

    if (!customerPricing) throw new Error("Customer pricing not found");

    oneTimeDeliveryCharge = calculateDeliveryCharges(
      distanceInKM,
      customerPricing.baseFare,
      customerPricing.baseDistance,
      customerPricing.fareAfterBaseDistance
    );

    const customerSurge = await CustomerSurge.findOne({
      geofenceId: customer.customerDetails.geofenceId,
      status: true,
    });

    if (customerSurge) {
      surgeCharges = calculateDeliveryCharges(
        distanceInKM,
        customerSurge.baseFare,
        customerSurge.baseDistance,
        customerSurge.fareAfterBaseDistance
      );
    }

    if (
      scheduledDetails?.startDate &&
      scheduledDetails?.endDate &&
      scheduledDetails?.time
    ) {
      deliveryChargeForScheduledOrder = (
        oneTimeDeliveryCharge * scheduledDetails.numOfDays
      ).toFixed(2);
    }

    taxAmount = await getTaxAmount(
      businessCategoryId,
      merchantFound.merchantDetail.geofenceId,
      itemTotal,
      deliveryChargeForScheduledOrder || oneTimeDeliveryCharge
    );
  }

  return {
    oneTimeDeliveryCharge,
    surgeCharges,
    deliveryChargeForScheduledOrder,
    taxAmount,
    itemTotal,
  };
};

// Function to apply discounts
const applyDiscounts = async ({ items, itemTotal, merchantId }) => {
  let merchantDiscountAmount = 0;

  // Fetch all products with their discounts in a single query
  const productIds = items.map((item) => item.productId);
  const products = await Product.find({ _id: { $in: productIds } })
    .populate("discountId")
    .exec();

  const currentDate = new Date();

  for (const item of items) {
    const product = products.find((p) => p._id.equals(item.productId));
    if (!product) continue;

    // Check if product has a valid discount
    const validProductDiscount =
      product.discountId &&
      product.discountId.status &&
      new Date(product.discountId.validFrom) <= currentDate &&
      new Date(product.discountId.validTo).setHours(23, 59, 59, 999) >=
        currentDate;

    if (validProductDiscount) continue;

    // Apply merchant discount
    const merchantDiscount = await MerchantDiscount.findOne({
      merchantId,
      status: true,
    });

    if (merchantDiscount && itemTotal >= merchantDiscount.maxCheckoutValue) {
      if (
        new Date(merchantDiscount.validFrom) <= currentDate &&
        new Date(merchantDiscount.validTo).setHours(23, 59, 59, 999) >=
          currentDate
      ) {
        const discountValue =
          merchantDiscount.discountType === "Percentage-discount"
            ? Math.min(
                (itemTotal * merchantDiscount.discountValue) / 100,
                merchantDiscount.maxDiscountValue
              )
            : merchantDiscount.discountValue;
        merchantDiscountAmount += discountValue;
      }
    }
  }

  return merchantDiscountAmount;
};

// Function to calculate bill
const calculateBill = (
  itemTotal,
  deliveryCharges,
  surgeCharges,
  flatDiscount,
  merchantDiscountAmount,
  taxAmount,
  addedTip = 0
) => {
  // Calculate total discount amount once
  const totalDiscountAmount =
    parseFloat(flatDiscount || 0) + parseFloat(merchantDiscountAmount || 0);

  // Calculate subtotal and grand total in one go
  const subTotal = calculateSubTotal({
    itemTotal,
    surgeCharges,
    deliveryCharge: deliveryCharges,
    addedTip,
    totalDiscountAmount,
  });

  const grandTotal = calculateGrandTotal({
    itemTotal,
    surgeCharges,
    deliveryCharge: deliveryCharges,
    addedTip,
    taxAmount,
  });

  // Calculate discounted grand total only if there is a discount
  const discountedGrandTotal =
    totalDiscountAmount > 0
      ? (grandTotal - totalDiscountAmount).toFixed(2)
      : grandTotal.toFixed(2);

  return {
    itemTotal,
    originalDeliveryCharge: deliveryCharges,
    addedTip,
    subTotal: parseFloat(subTotal).toFixed(2),
    taxAmount: parseFloat(taxAmount).toFixed(2),
    surgePrice: surgeCharges || null,
    discountedAmount: totalDiscountAmount > 0 ? totalDiscountAmount : null,
    originalGrandTotal: Math.round(grandTotal),
    discountedGrandTotal: Math.round(discountedGrandTotal),
  };
};

// =====================
// ========ADMIN========
// =====================

// Fetch merchant details based on deliveryMode
const fetchMerchantDetails = async (
  merchantId,
  deliveryMode,
  deliveryOption,
  next
) => {
  if (!merchantId || !["Take Away", "Home Delivery"].includes(deliveryMode)) {
    return null;
  }

  const merchantFound = await Merchant.findById(merchantId);
  if (!merchantFound) {
    return next(appError("Merchant not found", 404));
  }

  // Validate delivery option
  validateDeliveryOption(merchantFound, deliveryOption);

  return merchantFound;
};

// Ensure customer address validity
const validateCustomerAddress = (
  newCustomer,
  deliveryMode,
  newCustomerAddress,
  newPickupAddress,
  newDeliveryAddress
) => {
  // Check if the customer is new and delivery mode is not Take Away or Custom Order
  if (newCustomer && !["Take Away", "Custom Order"].includes(deliveryMode)) {
    // Validate Home Delivery address requirement
    if (deliveryMode === "Home Delivery" && !newCustomerAddress) {
      throw new Error("Customer address is required");
    }

    // Validate Pick and Drop address requirements
    if (
      deliveryMode === "Pick and Drop" &&
      (!newPickupAddress || !newDeliveryAddress)
    ) {
      throw new Error("Pickup and Delivery address are required");
    }
  }
};

const validateDeliveryOption = (merchant, deliveryOption) => {
  const { deliveryOption: merchantOption } = merchant.merchantDetail;

  if (merchantOption !== "Both" && merchantOption !== deliveryOption) {
    throw new Error("Merchant does not support this delivery option");
  }

  return null;
};

const handleDeliveryModeForAdmin = async (
  deliveryMode,
  customer,
  customerAddressType,
  customerAddressOtherAddressId,
  newCustomer,
  newCustomerAddress,
  merchant,
  pickUpAddressType,
  pickUpAddressOtherAddressId,
  deliveryAddressType,
  deliveryAddressOtherAddressId,
  newPickupAddress,
  newDeliveryAddress,
  customPickupLocation
) => {
  const addressDetails = await handleAddressDetails(
    deliveryMode,
    customer,
    customerAddressType,
    customerAddressOtherAddressId,
    newCustomer,
    newCustomerAddress,
    merchant,
    pickUpAddressType,
    pickUpAddressOtherAddressId,
    deliveryAddressType,
    deliveryAddressOtherAddressId,
    newPickupAddress,
    newDeliveryAddress,
    customPickupLocation
  );

  let distance = 0;

  const customOrderWithPick = addressDetails?.pickupLocation?.length === 2;

  // Calculate distance only if the delivery mode is not "Take Away" and pickupLocation is available
  if (deliveryMode !== "Take Away" && customOrderWithPick) {
    const { distanceInKM } = await getDistanceFromPickupToDelivery(
      addressDetails.pickupLocation,
      addressDetails.deliveryLocation
    );

    distance = distanceInKM;
  }

  return {
    ...addressDetails,
    distanceInKM: distance,
  };
};

const calculateDeliveryChargeHelperForAdmin = async (
  deliveryMode,
  distanceInKM,
  merchant,
  customer,
  items,
  scheduledDetails,
  vehicleType,
  pickupLocation,
  selectedBusinessCategory
) => {
  // Handle each delivery mode with a switch statement for clarity
  switch (deliveryMode) {
    case "Take Away":
      return {
        oneTimeDeliveryCharge: 0,
        surgeCharges: 0,
        deliveryChargeForScheduledOrder: 0,
        taxAmount: 0,
        itemTotal: calculateItemTotal(items, scheduledDetails?.numOfDays),
      };

    case "Home Delivery":
      return await calculateDeliveryChargesHelper(
        deliveryMode,
        distanceInKM,
        merchant,
        customer,
        items,
        scheduledDetails,
        selectedBusinessCategory
      );

    case "Pick and Drop":
      return await pickAndDropCharges(
        distanceInKM,
        scheduledDetails,
        vehicleType,
        items,
        pickupLocation
      );

    case "Custom Order":
      return await customOrderCharges(
        customer,
        items,
        distanceInKM,
        scheduledDetails
      );

    default:
      throw new Error("Invalid delivery mode");
  }
};

const pickAndDropCharges = async (
  distanceInKM,
  scheduledDetails,
  vehicleType,
  items,
  pickupLocation
) => {
  const selectedVehicle = vehicleType;

  // Fetch all available vehicle types from the Agent model
  const agents = await Agent.find({});
  const uniqueVehicleTypes = [
    ...new Set(
      agents.flatMap((agent) =>
        agent.vehicleDetail.map((vehicle) => vehicle.type)
      )
    ),
  ];

  const [latitude, longitude] = pickupLocation;
  const geofenceFound = await geoLocation(latitude, longitude);

  // Fetch customer pricing details for all vehicle types
  const customerPricingArray = await CustomerPricing.find({
    deliveryMode: "Pick and Drop",
    geofenceId: geofenceFound.id,
    status: true,
    vehicleType: { $in: uniqueVehicleTypes },
  });

  if (!customerPricingArray.length) {
    throw new Error("Customer pricing not found");
  }

  // Calculate surge charges if applicable
  const customerSurge = await CustomerSurge.findOne({
    geofenceId: geofenceFound.id,
    status: true,
  });

  const surgeCharges = customerSurge
    ? calculateDeliveryCharges(
        distanceInKM,
        customerSurge.baseFare,
        customerSurge.baseDistance,
        customerSurge.fareAfterBaseDistance
      )
    : 0;

  // Find pricing for the selected vehicle
  const vehiclePrice = customerPricingArray.find(
    (pricing) => pricing.vehicleType === selectedVehicle.toString()
  );

  if (!vehiclePrice) {
    throw new Error("Vehicle pricing not found");
  }

  // Calculate delivery charges based on vehicle price
  const deliveryCharges = calculateDeliveryCharges(
    distanceInKM,
    vehiclePrice.baseFare,
    vehiclePrice.baseDistance,
    vehiclePrice.fareAfterBaseDistance
  );

  // Calculate total weight of items for additional weight charges
  const totalWeight = getTotalItemWeight("Pick and Drop", items);

  const additionalWeightCharge = calculateAdditionalWeightCharge(
    totalWeight,
    vehiclePrice.baseWeightUpto,
    vehiclePrice.fareAfterBaseWeight
  );

  // Calculate one-time delivery charge
  const oneTimeDeliveryCharge = (
    parseFloat(deliveryCharges) + parseFloat(additionalWeightCharge)
  ).toFixed(2);

  // Calculate delivery charge for scheduled orders if applicable
  let deliveryChargeForScheduledOrder;

  if (
    scheduledDetails?.startDate &&
    scheduledDetails?.endDate &&
    scheduledDetails?.time
  ) {
    deliveryChargeForScheduledOrder = (
      oneTimeDeliveryCharge * scheduledDetails.numOfDays
    ).toFixed(2);
  }

  return {
    oneTimeDeliveryCharge: oneTimeDeliveryCharge || null,
    surgeCharges: surgeCharges || null,
    deliveryChargeForScheduledOrder: deliveryChargeForScheduledOrder || null,
    taxAmount: null,
    itemTotal: null,
  };
};

const customOrderCharges = async (
  customer,
  items,
  distance,
  scheduledDetails
) => {
  // Fetch customer pricing for custom orders
  const customerPricing = await CustomerPricing.findOne({
    deliveryMode: "Custom Order",
    geofenceId: customer.customerDetails.geofenceId,
    status: true,
  });

  if (!customerPricing) throw new Error("Customer pricing not found");

  // Calculate one-time delivery charge
  let oneTimeDeliveryCharge;

  if (distance) {
    oneTimeDeliveryCharge = calculateDeliveryCharges(
      distance,
      customerPricing.baseFare,
      customerPricing.baseDistance,
      customerPricing.fareAfterBaseDistance
    );
  } else {
    oneTimeDeliveryCharge = customerPricing.purchaseFarePerHour;
  }

  // Fetch surge charges if applicable
  const customerSurge = await CustomerSurge.findOne({
    geofenceId: customer.customerDetails.geofenceId,
    status: true,
  });

  const surgeCharges = customerSurge
    ? calculateDeliveryCharges(
        distance,
        customerSurge.baseFare,
        customerSurge.baseDistance,
        customerSurge.fareAfterBaseDistance
      )
    : 0;

  // Calculate total weight of items for additional weight charges
  const totalWeight = getTotalItemWeight("Custom Order", items);

  const additionalWeightCharge = calculateAdditionalWeightCharge(
    totalWeight,
    customerPricing.baseWeightUpto,
    customerPricing.fareAfterBaseWeight
  );

  // Update one-time delivery charge with additional weight charge
  oneTimeDeliveryCharge += parseFloat(additionalWeightCharge);

  // Calculate delivery charge for scheduled orders if applicable
  let deliveryChargeForScheduledOrder;

  if (
    scheduledDetails?.startDate &&
    scheduledDetails?.endDate &&
    scheduledDetails?.time
  ) {
    deliveryChargeForScheduledOrder = (
      oneTimeDeliveryCharge * scheduledDetails.numOfDays
    ).toFixed(2);
  }

  return {
    oneTimeDeliveryCharge: distance ? oneTimeDeliveryCharge.toFixed(2) : 0,
    surgeCharges: distance ? surgeCharges.toFixed(2) : 0,
    deliveryChargeForScheduledOrder: distance
      ? deliveryChargeForScheduledOrder
      : 0,
    taxAmount: 0,
    itemTotal: 0,
  };
};

const saveCustomerCart = async (
  deliveryMode,
  deliveryOption,
  merchant,
  customer,
  pickupLocation,
  pickupAddress,
  deliveryLocation,
  deliveryAddress,
  distance,
  scheduledDetails,
  billDetail,
  vehicleType,
  items,
  instructionToMerchant,
  instructionToDeliveryAgent,
  instructionInPickup,
  instructionInDelivery
) => {
  const updatedItems =
    deliveryMode === "Custom Order"
      ? items.map((item) => ({
          ...item,
          itemId: new mongoose.Types.ObjectId(),
        }))
      : items;

  const cartDetails = {
    customerId: customer._id,
    merchantId: merchant?._id || null,
    items: updatedItems,
    cartDetail: {
      pickupLocation,
      pickupAddress,
      deliveryLocation,
      deliveryAddress,
      deliveryMode,
      deliveryOption,
      instructionToMerchant,
      instructionToDeliveryAgent,
      instructionInPickup,
      instructionInDelivery,
      distance,
      startDate: scheduledDetails?.startDate || null,
      endDate: scheduledDetails?.endDate || null,
      time: scheduledDetails?.time || null,
      numOfDays: scheduledDetails?.numOfDays || null,
    },
    billDetail:
      deliveryMode === "Pick and Drop" || deliveryMode === "Custom Order"
        ? { ...billDetail, vehicleType }
        : billDetail,
  };

  if (["Take Away", "Home Delivery"].includes(deliveryMode)) {
    return await CustomerCart.findOneAndUpdate(
      { customerId: customer._id },
      { $set: cartDetails },
      { new: true, upsert: true }
    );
  } else if (["Pick and Drop", "Custom Order"].includes(deliveryMode)) {
    return await PickAndCustomCart.findOneAndUpdate(
      { customerId: customer._id },
      { $set: cartDetails },
      { new: true, upsert: true }
    );
  }
};

// ==============================
// =========Create Order=========
// ==============================

const getCartByDeliveryMode = async (cartId, deliveryMode) => {
  if (["Pick and Drop", "Custom Order"].includes(deliveryMode))
    return await PickAndCustomCart.findById(cartId);
  if (["Take Away", "Home Delivery"].includes(deliveryMode))
    return await CustomerCart.findById(cartId);
  return null;
};

const calculateDeliveryTime = (merchant, cartDeliveryMode) => {
  const deliveryTime = new Date();
  const extraMinutes =
    cartDeliveryMode === "Take Away" || cartDeliveryMode === "Home Delivery"
      ? parseInt(merchant?.merchantDetail.deliveryTime || 60, 10)
      : 60;
  deliveryTime.setMinutes(deliveryTime.getMinutes() + extraMinutes);
  return deliveryTime;
};

const prepareOrderDetails = async (cart, paymentMode) => {
  const isScheduled = cart.cartDetail.deliveryOption === "Scheduled";
  if (paymentMode === "Cash-on-delivery" && isScheduled)
    throw new Error("Pay on delivery is not supported for scheduled order");

  let formattedItems, purchasedItems;

  if (["Take Away", "Home Delivery"].includes(cart.cartDetail.deliveryMode)) {
    const populatedCartWithVariantNames = await formattedCartItems(cart);

    formattedItems = populatedCartWithVariantNames.items.map((item) => {
      return {
        itemName: item.productId.productName,
        itemImageURL: item.productId.productImageURL,
        quantity: item.quantity,
        price: item.price,
        variantTypeName: item?.variantTypeId?.variantTypeName,
      };
    });

    purchasedItems = await filterProductIdAndQuantity(
      populatedCartWithVariantNames.items
    );
  }

  const billDetail = {
    ...cart.billDetail,
    deliveryCharge:
      cart.billDetail.discountedDeliveryCharge ||
      cart.billDetail.originalDeliveryCharge,
    grandTotal:
      cart.billDetail.discountedGrandTotal ||
      cart.billDetail.originalGrandTotal,
  };

  return {
    formattedItems,
    purchasedItems,
    billDetail,
  };
};

const updateCustomerTransaction = async (customer, billDetail) => {
  const transaction = {
    madeOn: new Date(),
    transactionType: "Bill",
    transactionAmount: billDetail.grandTotal,
    type: "Debit",
  };
  customer.transactionDetail.push(transaction);
  await customer.save();
};

const clearCart = async (customerId, deliveryMode) => {
  const cartModel =
    deliveryMode === "Pick and Drop" || deliveryMode === "Custom Order"
      ? PickAndCustomCart
      : CustomerCart;
  await cartModel.deleteOne({ customerId });
};

// ==============================
// =========Customer APP=========
// ==============================
const processDeliveryDetailInApp = async (
  customer,
  pickUpAddressType,
  pickUpAddressOtherAddressId,
  newPickupAddress,
  deliveryAddressType,
  deliveryAddressOtherAddressId,
  newDeliveryAddress
) => {
  let pickupLocation, pickupAddress, deliveryLocation, deliveryAddress;

  if (newPickupAddress) {
    pickupLocation = [newPickupAddress.latitude, newPickupAddress.longitude];
    pickupAddress = newPickupAddress;
  }

  if (pickUpAddressType) {
    const address = getAddressDetails(
      customer,
      pickUpAddressType,
      pickUpAddressOtherAddressId
    );
    if (!address) throw new Error("Pickup address not found");
    pickupLocation = address.coordinates;
    pickupAddress = address;
  }

  if (newDeliveryAddress) {
    deliveryLocation = [
      newDeliveryAddress.latitude,
      newDeliveryAddress.longitude,
    ];
    deliveryAddress = newDeliveryAddress;
  }

  if (deliveryAddressType) {
    const address = getAddressDetails(
      customer,
      deliveryAddressType,
      deliveryAddressOtherAddressId
    );
    if (!address) throw new Error("Delivery address not found");
    deliveryLocation = address.coordinates;
    deliveryAddress = address;
  }

  if (
    !pickupLocation ||
    !pickupAddress ||
    !deliveryLocation ||
    !deliveryAddress
  ) {
    throw new Error("Incomplete address details");
  }
  return {
    pickupLocation,
    pickupAddress,
    deliveryLocation,
    deliveryAddress,
  };
};

const processHomeDeliveryDetailInApp = async (
  deliveryMode,
  customer,
  merchant,
  deliveryAddressType,
  deliveryAddressOtherAddressId,
  newDeliveryAddress
) => {
  let pickupLocation = [],
    pickupAddress = {},
    deliveryLocation = [],
    deliveryAddress = {};
  distance = 0;

  if (merchant) {
    pickupLocation = merchant.merchantDetail.location;

    pickupAddress = {
      fullName: merchant.merchantDetail.merchantName,
      area: merchant.merchantDetail.displayAddress,
      phoneNumber: merchant.phoneNumber,
    };
  }

  if (deliveryMode === "Home Delivery") {
    if (deliveryAddressType) {
      const address = getAddressDetails(
        customer,
        deliveryAddressType,
        deliveryAddressOtherAddressId
      );

      if (!address) throw new Error("Delivery address not found");
      deliveryLocation = address.coordinates;
      deliveryAddress = address;
    }

    if (newDeliveryAddress) {
      deliveryLocation = [
        newDeliveryAddress.latitude,
        newDeliveryAddress.longitude,
      ];
      deliveryAddress = newDeliveryAddress;
    }

    if (
      !pickupLocation ||
      !pickupAddress ||
      !deliveryLocation ||
      !deliveryAddress
    ) {
      throw new Error("Incomplete address details");
    }

    const { distanceInKM } = await getDistanceFromPickupToDelivery(
      pickupLocation,
      deliveryLocation
    );

    distance = distanceInKM;
  }

  return {
    pickupLocation,
    pickupAddress,
    deliveryLocation,
    deliveryAddress,
    distance,
  };
};

module.exports = {
  // Invoice
  findOrCreateCustomer,
  processSchedule,
  calculateItemTotal,
  getTotalItemWeight,
  calculateAdditionalWeightCharge,
  calculateSubTotal,
  calculateGrandTotal,
  getTotalDaysBetweenDates,
  formattedCartItems,
  handleAddressDetails,
  validateDeliveryOption,
  processScheduledDelivery,
  handleDeliveryMode,
  applyDiscounts,
  calculateBill,
  fetchMerchantDetails,
  validateCustomerAddress,
  calculateDeliveryChargesHelper,
  handleDeliveryModeForAdmin,
  calculateDeliveryChargeHelperForAdmin,
  saveCustomerCart,
  // Order
  getCartByDeliveryMode,
  calculateDeliveryTime,
  prepareOrderDetails,
  updateCustomerTransaction,
  clearCart,
  // App
  processDeliveryDetailInApp,
  processHomeDeliveryDetailInApp,
};
