const axios = require("axios");
const Tax = require("../models/Tax");
const appError = require("./appError");
const Customer = require("../models/Customer");
const Merchant = require("../models/Merchant");
const Order = require("../models/Order");
const ScheduledOrder = require("../models/ScheduledOrder");
const cron = require("node-cron");

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
  const { data } = await axios.get(
    `https://apis.mapmyindia.com/advancedmaps/v1/${process.env.MapMyIndiaAPIKey}/distance_matrix_eta/${profile}/${pickupCoordinates[1]},${pickupCoordinates[0]};${deliveryCoordinates[1]},${deliveryCoordinates[0]}`
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
    return baseFare;
  } else {
    return baseFare + (distance - baseDistance) * fareAfterBaseDistance;
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

module.exports = {
  sortMerchantsBySponsorship,
  getDistanceFromPickupToDelivery,
  calculateDeliveryCharges,
  getTaxAmount,
  createOrdersFromScheduled,
  updateOneDayLoyaltyPointEarning,
};
