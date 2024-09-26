const Agent = require("../models/Agent");
const BusinessCategory = require("../models/BusinessCategory");
const CustomerCart = require("../models/CustomerCart");
const CustomerPricing = require("../models/CustomerPricing");
const CustomerSurge = require("../models/CustomerSurge");
const Merchant = require("../models/Merchant");
const MerchantDiscount = require("../models/MerchantDiscount");
const PickAndCustomCart = require("../models/PickAndCustomCart");
const Product = require("../models/Product");
const appError = require("./appError");
const {
  processSchedule,
  calculateSubTotal,
  calculateGrandTotal,
  handleAddressDetails,
  calculateItemTotal,
  calculateAdditionalWeightCharge,
  getTotalItemWeight,
} = require("./createOrderHelpers");
const {
  calculateDeliveryCharges,
  getTaxAmount,
  getDistanceFromPickupToDelivery,
} = require("./customerAppHelpers");
const geoLocation = require("./getGeoLocation");

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

  console.log("1", items);
  const itemTotal = calculateItemTotal(items, scheduledDetails?.numOfDays);
  console.log("2");

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
  console.log("itemTotal", itemTotal);
  console.log("deliveryCharges", deliveryCharges);
  console.log("surgeCharges", surgeCharges);
  console.log("flatDiscount", flatDiscount);
  console.log("merchantDiscountAmount", merchantDiscountAmount);
  console.log("taxAmount", taxAmount);
  console.log("addedTip", addedTip);

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
  newDeliveryAddress
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
      newDeliveryAddress
    );

  let distance = 0;
  if (deliveryMode !== "Take Away") {
    // const { distanceInKM } = await getDistanceFromPickupToDelivery(
    //   merchant.merchantDetail.location,
    //   deliveryLocation
    // );

    // distance = distanceInKM;
    distance = 5;
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
      return await customOrderCharges(distanceInKM, scheduledDetails, items);
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

  console.log("customerSurge", customerSurge);

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

  console.log("SURGE", surgeCharges);

  // return;

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

  const totalWeight = getTotalItemWeight(items);

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

const customOrderCharges = async () => {
  return {
    oneTimeDeliveryCharge: 5,
    surgeCharges: 5,
    deliveryChargeForScheduledOrder: 5,
    taxAmount: 5,
    itemTotal: 5,
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
  console.log("MODE", deliveryMode);

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
          billDetail,
        },
      },
      { new: true, upsert: true }
    );
  }
};

module.exports = {
  processScheduledDelivery,
  handleDeliveryMode,
  calculateDeliveryChargesHelper,
  applyDiscounts,
  calculateBill,
  // ADMIN
  fetchMerchantDetails,
  validateCustomerAddress,
  validateDeliveryOption,
  handleDeliveryModeForAdmin,
  calculateDeliveryChargeHelperForAdmin,
  saveCustomerCart,
};
