const Agent = require("../models/Agent");
const BusinessCategory = require("../models/BusinessCategory");
const Customer = require("../models/Customer");
const CustomerCart = require("../models/CustomerCart");
const CustomerPricing = require("../models/CustomerPricing");
const CustomerSurge = require("../models/CustomerSurge");
const Merchant = require("../models/Merchant");
const MerchantDiscount = require("../models/MerchantDiscount");
const PickAndCustomCart = require("../models/PickAndCustomCart");
const Product = require("../models/Product");
const appError = require("./appError");

const { convertToUTC } = require("./formatters");

const geoLocation = require("./getGeoLocation");

const {
  calculateDeliveryCharges,
  getTaxAmount,
  getDistanceFromPickupToDelivery,
} = require("./customerAppHelpers");

// Create or return the existing customer
const findOrCreateCustomer = async ({
  customerId,
  newCustomer,
  customerAddress,
  deliveryMode,
  res,
}) => {
  if (customerId) {
    const customer = await Customer.findById(customerId);
    if (!customer) throw new Error("Customer not found");
    return customer;
  } else if (customerAddress) {
    // Check if the customer already exists by phone number
    const existingCustomerByPhone = await Customer.findOne({
      phoneNumber: newCustomer.phoneNumber,
    });

    // Check if the customer already exists by email
    const existingCustomerByEmail = await Customer.findOne({
      email: newCustomer.email,
    });

    if (existingCustomerByPhone || existingCustomerByEmail) {
      // If customer exists, return the existing customer instead of creating a new one
      return existingCustomerByPhone || existingCustomerByEmail;
    }

    // If customer does not exist, create a new customer
    const location = [customerAddress.latitude, customerAddress.longitude];
    const updatedAddress = {
      fullName: customerAddress.fullName,
      phoneNumber: customerAddress.phoneNumber,
      flat: customerAddress.flat,
      area: customerAddress.area,
      landmark: customerAddress.landmark,
      coordinates: location,
    };

    const geofence = await geoLocation(
      customerAddress.latitude,
      customerAddress.longitude
    );

    if (!geofence) {
      return {
        message: "User coordinates are outside defined geofences",
      };
    }

    const updatedCustomerDetails = {
      location: location,
      geofenceId: geofence ? geofence._id : null,
      homeAddress:
        customerAddress.addressType === "home" ? updatedAddress : null,
      workAddress:
        customerAddress.addressType === "work" ? updatedAddress : null,
      otherAddress:
        customerAddress.addressType === "other" ? [updatedAddress] : [],
    };

    const updatedNewCustomer = {
      fullName: newCustomer.fullName,
      email: newCustomer.email,
      phoneNumber: newCustomer.phoneNumber,
      customerDetails: updatedCustomerDetails,
    };

    return await Customer.create(updatedNewCustomer);
  } else if (newCustomer && deliveryMode === "Take Away") {
    const existingCustomerByPhone = await Customer.findOne({
      phoneNumber: newCustomer.phoneNumber,
    });

    // Check if the customer already exists by email
    const existingCustomerByEmail = await Customer.findOne({
      email: newCustomer.email,
    });

    if (existingCustomerByPhone || existingCustomerByEmail) {
      // If customer exists, return the existing customer instead of creating a new one
      return existingCustomerByPhone || existingCustomerByEmail;
    }

    return await Customer.create({
      fullName: newCustomer.fullName,
      email: newCustomer.email,
      phoneNumber: newCustomer.phoneNumber,
    });
  }
};

// Get the scheduled details
const processSchedule = (ifScheduled) => {
  let startDate = ifScheduled.startDate;
  let endDate = ifScheduled.endDate;
  let time = ifScheduled.time && convertToUTC(ifScheduled.time);
  let numOfDays;

  if (startDate && endDate && time) {
    startDate = new Date(startDate);
    startDate.setUTCHours(0, 0, 0, 0);

    endDate = new Date(endDate);
    endDate.setUTCHours(23, 59, 59, 999);

    numOfDays = getTotalDaysBetweenDates(startDate, endDate);
  }

  return { startDate, endDate, time, numOfDays };
};

// Calculat the item total in cart
const calculateItemTotal = (items, numOfDays) => {
  let calculatedTotal;

  if (numOfDays) {
    const amount = items
      .reduce((total, item) => total + item.price * item.quantity, 0)
      .toFixed(2);

    calculatedTotal = amount * numOfDays;
  } else {
    calculatedTotal = items
      .reduce((total, item) => total + item.price * item.quantity, 0)
      .toFixed(2);
  }

  return calculatedTotal;
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
  if (totalWeight > baseWeight) {
    const fare = (
      (parseFloat(totalWeight) - parseFloat(baseWeight)) *
      parseFloat(fareAfterBaseWeight)
    ).toFixed(2);

    return parseFloat(fare);
  }

  return 0;
};

// Calcula the subTotal in cart
const calculateSubTotal = ({
  itemTotal,
  surgeCharge = 0,
  deliveryCharge,
  addedTip = 0,
  totalDiscountAmount = 0,
}) =>
  (
    parseFloat(itemTotal) +
    parseFloat(surgeCharge) +
    parseFloat(deliveryCharge) +
    parseFloat(addedTip) -
    parseFloat(totalDiscountAmount)
  ).toFixed(2);

// Calculate the grandTotal of cart
const calculateGrandTotal = ({
  itemTotal,
  surgeCharges = 0,
  deliveryCharge,
  addedTip = 0,
  taxAmount,
}) => {
  return Math.round(
    parseFloat(itemTotal) +
      parseFloat(surgeCharges) +
      parseFloat(deliveryCharge) +
      parseFloat(addedTip) +
      parseFloat(taxAmount)
  ).toFixed(2);
};

// Get the number of days betweeb scheduled dates
const getTotalDaysBetweenDates = (startDate, endDate) =>
  Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

// Function for formatting items in the response
const formattedCartItems = async (cart) => {
  const populatedCart = cart.toObject();

  // Populate the product details for each item
  const productIds = populatedCart.items.map((item) => item.productId);
  const products = await Product.find({ _id: { $in: productIds } });

  populatedCart.items = populatedCart.items.map((item) => {
    const product = products.find((p) => p._id.equals(item.productId));
    let variantTypeName = null;
    let variantTypeData = null;

    if (item.variantTypeId && product && product.variants) {
      const variantType = product.variants
        .flatMap((variant) => variant.variantTypes)
        .find((type) => type._id.equals(item.variantTypeId));

      if (variantType) {
        variantTypeName = variantType.typeName;
        variantTypeData = {
          _id: variantType._id,
          variantTypeName: variantTypeName,
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

  if (addressType === "home") {
    customer.customerDetails.homeAddress = newAddress;
  } else if (addressType === "work") {
    customer.customerDetails.workAddress = newAddress;
  } else if (addressType === "other") {
    const otherIndex = customer.customerDetails.otherAddress.findIndex(
      (addr) => addr.id.toString() === customerAddressOtherAddressId
    );

    if (otherIndex !== -1) {
      customer.customerDetails.otherAddress[otherIndex] = newAddress;
    } else {
      customer.customerDetails.otherAddress.push(newAddress);
    }
  }

  await customer.save();
  return location;
};

// Helper function to retrieve address details based on type
const getAddressDetails = (customer, addressType, addressId) => {
  if (addressType === "home") {
    return customer.customerDetails.homeAddress;
  } else if (addressType === "work") {
    return customer.customerDetails.workAddress;
  } else if (addressType === "other") {
    return customer.customerDetails.otherAddress.find(
      (addr) => addr.id.toString() === addressId
    );
  }
  return null;
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

  if (deliveryMode === "Take Away") {
    pickupLocation = merchantFound.merchantDetail.location;
    pickupAddress = {
      fullName: merchantFound.merchantDetail.merchantName,
      area: merchantFound.merchantDetail.displayAddress,
      phoneNumber: merchantFound.phoneNumber,
    };
    deliveryLocation = merchantFound.merchantDetail.location;
    deliveryAddress = null;
  }

  // Handling Home Delivery
  if (deliveryMode === "Home Delivery") {
    pickupLocation = merchantFound.merchantDetail.location;
    pickupAddress = {
      fullName: merchantFound.merchantDetail.merchantName,
      area: merchantFound.merchantDetail.displayAddress,
      phoneNumber: merchantFound.phoneNumber,
    };

    if (newCustomer) {
      deliveryLocation = [
        newCustomerAddress.latitude,
        newCustomerAddress.longitude,
      ];
      deliveryAddress = newCustomerAddress;
    } else {
      if (newCustomerAddress) {
        deliveryLocation = await updateCustomerAddress(
          newCustomerAddress.type,
          newCustomerAddress,
          customer,
          customerAddressOtherAddressId
        );
        deliveryAddress = newCustomerAddress;
      } else {
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
  }

  // Handling Pick and Drop
  else if (deliveryMode === "Pick and Drop") {
    if (newPickupAddress) {
      pickupLocation = [newPickupAddress.latitude, newPickupAddress.longitude];
      pickupAddress = newPickupAddress;
    } else if (pickUpAddressType) {
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
    } else if (deliveryAddressType) {
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

  // Handling Custom Order
  else if (deliveryMode === "Custom Order") {
    if (customPickupLocation) {
      pickupLocation = [customPickupLocation[0], customPickupLocation[1]];
    }

    if (newDeliveryAddress) {
      deliveryLocation = [
        newDeliveryAddress.latitude,
        newDeliveryAddress.longitude,
      ];
      deliveryAddress = newDeliveryAddress;

      if (newDeliveryAddress.saveAddress) {
        await updateCustomerAddress(
          deliveryAddressType,
          newDeliveryAddress,
          customer,
          deliveryAddressOtherAddressId
        );
      }
    } else if (deliveryAddressType) {
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

  // Check if required details are present
  if (
    (deliveryMode === "Home Delivery" || deliveryMode === "Pick and Drop") &&
    (!pickupLocation || !pickupAddress || !deliveryLocation || !deliveryAddress)
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

// Helper function to process scheduled delivery
const processScheduledDelivery = (deliveryOption, req) => {
  if (deliveryOption === "Scheduled") {
    const { startDate, endDate, time, numOfDays } = processSchedule(
      req.body.ifScheduled
    );
    return { startDate, endDate, time, numOfDays };
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
  const { pickupLocation, pickupAddress, deliveryLocation, deliveryAddress } =
    await handleAddressDetails(
      deliveryMode,
      customer,
      customerAddressType,
      customerAddressOtherAddressId,
      newCustomer,
      newCustomerAddress,
      merchant
    );

  let distance = 0;
  if (deliveryMode !== "Take Away") {
    const { distanceInKM } = await getDistanceFromPickupToDelivery(
      merchant.merchantDetail.location,
      deliveryLocation
    );

    distance = distanceInKM;
  }

  return {
    pickupLocation,
    pickupAddress,
    deliveryLocation,
    deliveryAddress,
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
  scheduledDetails
) => {
  let oneTimeDeliveryCharge,
    surgeCharges,
    deliveryChargeForScheduledOrder,
    taxAmount;

  const itemTotal = calculateItemTotal(items, scheduledDetails?.numOfDays);

  if (deliveryMode === "Home Delivery") {
    const businessCategory = await BusinessCategory.findById(
      merchantFound.merchantDetail.businessCategoryId
    );
    if (!businessCategory) throw new Error("Business category not found");

    const customerPricing = await CustomerPricing.findOne({
      deliveryMode,
      businessCategoryId: businessCategory._id,
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
      businessCategory._id,
      merchantFound.merchantDetail.geofenceId,
      itemTotal,
      deliveryChargeForScheduledOrder || oneTimeDeliveryCharge
    );
  }

  return {
    oneTimeDeliveryCharge: oneTimeDeliveryCharge || null,
    surgeCharges: surgeCharges || null,
    deliveryChargeForScheduledOrder: deliveryChargeForScheduledOrder || null,
    taxAmount: taxAmount || null,
    itemTotal,
  };
};

// Function to apply discounts
const applyDiscounts = async ({ items, itemTotal, merchantId }) => {
  let merchantDiscountAmount = 0;

  for (const item of items) {
    const product = await Product.findById(item.productId)
      .populate("discountId")
      .exec();
    if (!product) continue;

    // Check if product has a valid discount
    const validProductDiscount =
      product.discountId &&
      product.discountId.status &&
      new Date(product.discountId.validFrom) <= new Date() &&
      new Date(product.discountId.validTo).setHours(23, 59, 59, 999) >=
        new Date();

    if (validProductDiscount) continue;

    // Apply merchant discount
    const merchantDiscount = await MerchantDiscount.findOne({
      merchantId,
      status: true,
    });
    if (merchantDiscount && itemTotal >= merchantDiscount.maxCheckoutValue) {
      const currentDate = new Date();
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
  addedTip
) => {
  const totalDiscountAmount = parseFloat(flatDiscount) + merchantDiscountAmount;

  const subTotal = calculateSubTotal({
    itemTotal,
    surgeCharges,
    deliveryCharge: deliveryCharges,
    addedTip,
    totalDiscountAmount,
  });

  const grandTotal = calculateGrandTotal({
    itemTotal,
    deliveryCharge: deliveryCharges,
    addedTip,
    taxAmount,
  });

  const discountedGrandTotal = totalDiscountAmount
    ? (grandTotal - totalDiscountAmount).toFixed(2)
    : null;

  return {
    itemTotal,
    originalDeliveryCharge: deliveryCharges,
    addedTip,
    subTotal,
    taxAmount,
    surgePrice: surgeCharges || null,
    discountedAmount: totalDiscountAmount || null,
    originalGrandTotal: Math.round(grandTotal),
    discountedGrandTotal:
      Math.round(discountedGrandTotal) || parseFloat(grandTotal),
  };
};

// ADMIN

// Fetch merchant details based on deliveryMode
const fetchMerchantDetails = async (
  merchantId,
  deliveryMode,
  deliveryOption,
  next
) => {
  if (
    !merchantId ||
    (deliveryMode !== "Take Away" && deliveryMode !== "Home Delivery")
  )
    return null;

  const merchantFound = await Merchant.findById(merchantId);
  if (!merchantFound) return next(appError("Merchant not found", 404));

  validateDeliveryOption(merchantFound, deliveryOption, next);

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
  if (
    newCustomer &&
    deliveryMode !== "Take Away" &&
    deliveryMode !== "Custom Order"
  ) {
    if (!newCustomerAddress && deliveryMode === "Home Delivery") {
      throw new Error("Customer address is required");
    }
    if (
      deliveryMode === "Pick and Drop" &&
      (!newPickupAddress || !newDeliveryAddress)
    ) {
      throw new Error("Pickup and Delivery address are required");
    }
  }
};

const validateDeliveryOption = (merchant, deliveryOption, next) => {
  const { deliveryOption: merchantOption } = merchant.merchantDetail;

  if (merchantOption !== "Both" && merchantOption !== deliveryOption) {
    return next(
      appError("Merchant does not support this delivery option", 400)
    );
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
  const { pickupLocation, pickupAddress, deliveryLocation, deliveryAddress } =
    await handleAddressDetails(
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
  if (deliveryMode !== "Take Away" && pickupLocation) {
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
  pickupLocation
) => {
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
        scheduledDetails
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
  const vehicleTypes = agents.flatMap((agent) =>
    agent.vehicleDetail.map((vehicle) => vehicle.type)
  );
  const uniqueVehicleTypes = [...new Set(vehicleTypes)];

  const latitude = pickupLocation[0];
  const longitude = pickupLocation[1];

  const geofenceFound = await geoLocation(latitude, longitude);

  // Fetch the customer pricing details for all vehicle types
  const customerPricingArray = await CustomerPricing.find({
    deliveryMode: "Pick and Drop",
    geofenceId: geofenceFound.id,
    status: true,
    vehicleType: { $in: uniqueVehicleTypes },
  });

  if (!customerPricingArray || customerPricingArray.length === 0) {
    return res.status(404).json({ error: "Customer pricing not found" });
  }

  const customerSurge = await CustomerSurge.findOne({
    geofenceId: geofenceFound.id,
    status: true,
  });

  let surgeCharges = 0;

  if (customerSurge) {
    let surgeBaseFare = customerSurge.baseFare;
    let surgeBaseDistance = customerSurge.baseDistance;
    let surgeFareAfterBaseDistance = customerSurge.fareAfterBaseDistance;

    surgeCharges = calculateDeliveryCharges(
      distanceInKM,
      surgeBaseFare,
      surgeBaseDistance,
      surgeFareAfterBaseDistance
    );
  }

  const vehiclePrice = customerPricingArray.find(
    (pricing) => pricing.vehicleType === selectedVehicle.toString()
  );

  if (!vehiclePrice) {
    return res.status(404).json({ error: "Vehicle pricing not found" });
  }

  const deliveryCharges = calculateDeliveryCharges(
    distanceInKM,
    vehiclePrice.baseFare,
    vehiclePrice.baseDistance,
    vehiclePrice.fareAfterBaseDistance
  );

  const totalWeight = getTotalItemWeight("Pick and Drop", items);

  let additionalWeightCharge = calculateAdditionalWeightCharge(
    totalWeight,
    vehiclePrice.baseWeightUpto,
    vehiclePrice.fareAfterBaseWeight
  );

  const oneTimeDeliveryCharge = (
    parseFloat(deliveryCharges) + parseFloat(additionalWeightCharge)
  ).toFixed(2);

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
  distanceInKM,
  scheduledDetails
) => {
  let oneTimeDeliveryCharge, surgeCharges, deliveryChargeForScheduledOrder;

  const customerPricing = await CustomerPricing.findOne({
    deliveryMode: "Custom Order",
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

  const totalWeight = getTotalItemWeight("Custom Order", items);

  let additionalWeightCharge = calculateAdditionalWeightCharge(
    totalWeight,
    customerPricing.baseWeightUpto,
    customerPricing.fareAfterBaseWeight
  );

  oneTimeDeliveryCharge =
    parseFloat(oneTimeDeliveryCharge) + parseFloat(additionalWeightCharge);

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
    oneTimeDeliveryCharge,
    surgeCharges,
    deliveryChargeForScheduledOrder,
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
  if (deliveryMode === "Take Away" || deliveryMode === "Home Delivery") {
    return await CustomerCart.findOneAndUpdate(
      { customerId: customer._id },
      {
        $set: {
          customerId: customer._id,
          merchantId: merchant._id,
          items,
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
          billDetail,
        },
      },
      { new: true, upsert: true }
    );
  } else if (
    deliveryMode === "Pick and Drop" ||
    deliveryMode === "Custom Order"
  ) {
    return await PickAndCustomCart.findOneAndUpdate(
      { customerId: customer._id },
      {
        $set: {
          customerId: customer._id,
          items,
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
          billDetail: {
            ...billDetail,
            vehicleType,
          },
        },
      },
      { new: true, upsert: true }
    );
  }
};

module.exports = {
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
  // Changes
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
};
