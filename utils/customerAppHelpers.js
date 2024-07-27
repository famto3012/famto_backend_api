const axios = require("axios");
const Tax = require("../models/Tax");
const appError = require("./appError");
const Customer = require("../models/Customer");
const Merchant = require("../models/Merchant");
const Order = require("../models/Order");
const ScheduledOrder = require("../models/ScheduledOrder");
const ScheduledPickAndCustom = require("../models/ScheduledPickAndCustom");
const CustomerPricing = require("../models/CustomerPricing");
const CustomerSurge = require("../models/CustomerSurge");

// Helper function to sort merchants by sponsorship
const sortMerchantsBySponsorship = (merchants) => {
  return merchants.sort((a, b) => {
    const aSponsorship = a.sponsorshipDetail.some((s) => s.sponsorshipStatus);
    const bSponsorship = b.sponsorshipDetail.some((s) => s.sponsorshipStatus);
    return bSponsorship - aSponsorship;
  });
};

const getDistanceFromPickupToDelivery = async (
  pickupCoordinates,
  deliveryCoordinates,
  profile = "biking"
) => {
  console.log("pickupCoordinates", pickupCoordinates);
  console.log("deliveryCoordinates", deliveryCoordinates);

  // distance_matrix_eta;
  // distance_matrix;
  // distance_matrix_traffic;

  const { data } = await axios.get(
    `https://apis.mapmyindia.com/advancedmaps/v1/${process.env.MapMyIndiaAPIKey}/distance_matrix/${profile}/${pickupCoordinates[1]},${pickupCoordinates[0]};${deliveryCoordinates[1]},${deliveryCoordinates[0]}`
  );

  if (
    data &&
    data.results &&
    data.results.distances &&
    data.results.distances.length > 0
  ) {
    const distance = data.results.distances[0][1] / 1000; // Distance in kilometers
    const durationInMinutes = Math.ceil(data.results.durations[0][1] / 60); // Duration in minutes

    const distanceInKM = parseFloat(distance).toFixed(2);

    return { distanceInKM, durationInMinutes };
  }
};

const calculateDeliveryCharges = (
  distance,
  baseFare,
  baseDistance,
  fareAfterBaseDistance
) => {
  if (distance <= baseDistance) {
    return parseFloat(baseFare);
  } else {
    return parseFloat(
      baseFare + (distance - baseDistance) * fareAfterBaseDistance
    );
  }
};

const getTaxAmount = async (
  businessCategoryId,
  geofenceId,
  itemTotal,
  deliveryCharges
) => {
  try {
    const taxFound = await Tax.findOne({
      assignToBusinessCategoryId: businessCategoryId,
      geofenceId,
    });

    if (!taxFound) {
      return next(appError("Tax not found", 404));
    }

    const taxPercentage = taxFound.tax;

    const taxAmount =
      ((parseFloat(itemTotal) + parseFloat(deliveryCharges)) * taxPercentage) /
      100;

    return parseFloat(taxAmount.toFixed(2));
  } catch (err) {
    next(appError(err.message));
  }
};

const createOrdersFromScheduled = async (scheduledOrder) => {
  try {
    const customer = await Customer.findById(scheduledOrder.customerId);

    if (!customer) {
      throw new Error("Customer not found", 404);
    }

    const merchant = await Merchant.findById(scheduledOrder.merchantId);

    if (!merchant) {
      throw new Error("Merchant not found", 404);
    }

    const newOrder = await Order.create({
      customerId: scheduledOrder.customerId,
      merchantId: scheduledOrder.merchantId,
      items: scheduledOrder.items,
      orderDetail: scheduledOrder.orderDetail,
      billDetail: scheduledOrder.billDetail,
      totalAmount: scheduledOrder.totalAmount,
      paymentMode: scheduledOrder.paymentMode,
      paymentStatus: scheduledOrder.paymentStatus,
      status: "Pending",
    });

    console.log("Order created successfully with order ID: " + newOrder._id);

    if (new Date() < new Date(scheduledOrder.endDate)) {
      const nextTime = new Date();
      nextTime.setDate(nextTime.getDate() + 1);

      await ScheduledOrder.findByIdAndUpdate(scheduledOrder._id, {
        time: nextTime,
      });
    } else {
      await ScheduledOrder.findByIdAndUpdate(scheduledOrder._id, {
        status: "Completed",
      });
    }
  } catch (err) {
    console.error("Error creating order from scheduled order:", err.message);
  }
};

const createOrdersFromScheduledPickAndDrop = async (scheduledOrder) => {
  try {
    const customer = await Customer.findById(scheduledOrder.customerId);

    if (!customer) {
      throw new Error("Customer not found", 404);
    }

    const newOrder = await Order.create({
      customerId: scheduledOrder.customerId,
      items: scheduledOrder.items,
      orderDetail: scheduledOrder.orderDetail,
      billDetail: scheduledOrder.billDetail,
      totalAmount: scheduledOrder.totalAmount,
      paymentMode: scheduledOrder.paymentMode,
      paymentStatus: scheduledOrder.paymentStatus,
      status: "Pending",
    });

    console.log("Order created successfully with order ID: " + newOrder._id);

    if (new Date() < new Date(scheduledOrder.endDate)) {
      const nextTime = new Date();
      nextTime.setDate(nextTime.getDate() + 1);

      await ScheduledPickAndCustom.findByIdAndUpdate(scheduledOrder._id, {
        time: nextTime,
      });
    } else {
      await ScheduledPickAndCustom.findByIdAndUpdate(scheduledOrder._id, {
        status: "Completed",
      });
    }
  } catch (err) {
    next(appError(err.message));
  }
};

const updateOneDayLoyaltyPointEarning = async () => {
  console.log("Running Update Loyalty point updation");
  try {
    await Customer.updateMany(
      {},
      { "customerDetails.loyaltyPointEarnedToday": 0 }
    );

    console.log("Loyalty points reset successfully");
  } catch (err) {
    console.log(`Error in updating loyalty point: ${err}`);
  }
};

const getDeliveryAndSurgeCharge = async (
  customerId,
  deliveryMode,
  distance,
  businessCategoryId
) => {
  const customer = await Customer.findById(customerId);

  if (!customer) {
    throw new Error("Customer not found", 404);
  }

  let customerPricing;

  if (deliveryMode === "Home Delivery") {
    customerPricing = await CustomerPricing.findOne({
      deliveryMode,
      businessCategoryId,
      geofenceId: customer.customerDetails.geofenceId,
      status: true,
    });
  } else {
    customerPricing = await CustomerPricing.findOne({
      deliveryMode,
      geofenceId: customer.customerDetails.geofenceId,
      status: true,
    });
  }

  if (!customerPricing) {
    throw new Error("Customer pricing not found", 404);
  }

  let baseFare = customerPricing.baseFare;
  let baseDistance = customerPricing.baseDistance;
  let fareAfterBaseDistance = customerPricing.fareAfterBaseDistance;

  const customerSurge = await CustomerSurge.findOne({
    geofenceId: customer.customerDetails.geofenceId,
    status: true,
  });

  let surgeCharges = 0;

  if (customerSurge) {
    let surgeBaseFare = customerSurge.baseFare;
    let surgeBaseDistance = customerSurge.baseDistance;
    let surgeFareAfterBaseDistance = customerSurge.fareAfterBaseDistance;

    surgeCharges = calculateDeliveryCharges(
      distance,
      surgeBaseFare,
      surgeBaseDistance,
      surgeFareAfterBaseDistance
    );
  }

  const deliveryCharges = calculateDeliveryCharges(
    distance,
    baseFare,
    baseDistance,
    fareAfterBaseDistance
  );

  return { deliveryCharges, surgeCharges };
};

const calculateDiscountedPrice = (product) => {
  const currentDate = new Date();
  const validFrom = new Date(product?.discountId?.validFrom);
  const validTo = new Date(product?.discountId?.validTo);

  // Adjusting the validTo date to the end of the day
  validTo?.setHours(23, 59, 59, 999);

  let discountPrice = product.price;
  let variantsWithDiscount = product?.variants;

  if (
    product?.discountId &&
    validFrom <= currentDate &&
    validTo >= currentDate &&
    product?.discountId?.status
  ) {
    const discount = product.discountId;

    if (discount.discountType === "Percentage-discount") {
      let discountAmount = (product.price * discount.discountValue) / 100;
      if (discountAmount > discount.maxAmount) {
        discountAmount = discount.maxAmount;
      }
      discountPrice -= discountAmount;
    } else if (discount.discountType === "Flat-discount") {
      discountPrice -= discount.discountValue;
    }

    if (discountPrice < 0) discountPrice = 0;

    // Apply discount to the variants if onAddOn is true
    if (discount.onAddOn) {
      variantsWithDiscount = product.variants.map((variant) => {
        const variantTypesWithDiscount = variant.variantTypes.map(
          (variantType) => {
            let variantDiscountPrice = variantType.price;
            if (discount.discountType === "Percentage-discount") {
              let discountAmount =
                (variantType.price * discount.discountValue) / 100;
              if (discountAmount > discount.maxAmount) {
                discountAmount = discount.maxAmount;
              }
              variantDiscountPrice -= discountAmount;
            } else if (discount.discountType === "Flat-discount") {
              variantDiscountPrice -= discount.discountValue;
            }

            if (variantDiscountPrice < 0) variantDiscountPrice = 0;

            return {
              ...variantType._doc,
              discountPrice: variantDiscountPrice,
            };
          }
        );
        return {
          ...variant._doc,
          variantTypes: variantTypesWithDiscount,
        };
      });
    }
  }

  return { discountPrice, variantsWithDiscount };
};

module.exports = {
  sortMerchantsBySponsorship,
  getDistanceFromPickupToDelivery,
  calculateDeliveryCharges,
  getTaxAmount,
  createOrdersFromScheduled,
  createOrdersFromScheduledPickAndDrop,
  updateOneDayLoyaltyPointEarning,
  getDeliveryAndSurgeCharge,
  calculateDiscountedPrice,
};
