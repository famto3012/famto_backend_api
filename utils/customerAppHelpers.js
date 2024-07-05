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
  deliveryCoordinates
) => {
  const { data } = await axios.get(
    `https://apis.mapmyindia.com/advancedmaps/v1/${process.env.MapMyIndiaAPIKey}/distance_matrix_eta/biking/${pickupCoordinates[1]},${pickupCoordinates[0]};${deliveryCoordinates[1]},${deliveryCoordinates[0]}`
  );

  if (
    data &&
    data.results &&
    data.results.distances &&
    data.results.distances.length > 0
  ) {
    const distanceInKm = data.results.distances[0][1] / 1000; // Distance in kilometers

    const fixedDistance = distanceInKm.toFixed(2);

    return fixedDistance;
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

    console.log(scheduledOrder.customerId);

    if (!customer) {
      throw new Error("Customer not found", 404);
    }

    const merchant = await Merchant.findById(scheduledOrder.merchantId);

    if (!merchant) {
      throw new Error("Merchant not found", 404);
    }

    const deliveryAddress = customer.customerDetails.otherAddress.find(
      (addr) =>
        addr.id.toString() === scheduledOrder.orderDetail.deliveryAddressType
    );

    const newOrder = await Order.create({
      customerId: scheduledOrder.customerId,
      merchantId: scheduledOrder.merchantId,
      items: scheduledOrder.items,
      orderDetail: scheduledOrder.orderDetail,
      totalAmount: scheduledOrder.totalAmount,
      paymentMode: scheduledOrder.paymentMode,
      paymentStatus: scheduledOrder.paymentStatus,
      status: "Pending",
      deliveryCharge: scheduledOrder.deliveryCharge,
      deliveryChargePerDay: scheduledOrder.deliveryChargePerDay,
    });

    const orderResponse = {
      _id: newOrder._id,
      customerId: newOrder.customerId,
      customerName:
        customer.fullName || (deliveryAddress && deliveryAddress.fullName),
      merchantId: newOrder.merchantId,
      merchantName: merchant.merchantDetail.merchantName,
      status: newOrder.status,
      totalAmount: newOrder.totalAmount,
      paymentMode: newOrder.paymentMode,
      paymentStatus: newOrder.paymentStatus,
      items: newOrder.items,
      deliveryAddress: deliveryAddress
        ? {
            fullName: deliveryAddress.fullName,
            phoneNumber: deliveryAddress.phoneNumber,
            flat: deliveryAddress.flat,
            area: deliveryAddress.area,
            landmark: deliveryAddress.landmark || null,
          }
        : null,
      orderDetail: {
        pickupLocation: merchant.merchantDetail.location,
        deliveryLocation: scheduledOrder.orderDetail.deliveryLocation,
        deliveryMode: scheduledOrder.orderDetail.deliveryMode,
        instructionToMerchant: scheduledOrder.orderDetail.instructionToMerchant,
        instructionToDeliveryAgent:
          scheduledOrder.orderDetail.instructionToDeliveryAgent,
        addedTip: scheduledOrder.orderDetail.addedTip,
        distance: scheduledOrder.orderDetail.distance,
        taxAmount: scheduledOrder.orderDetail.taxAmount,
      },
      createdAt: newOrder.createdAt,
      updatedAt: newOrder.updatedAt,
    };

    console.log("Order created successfully:", orderResponse);

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

cron.schedule("* * * * *", async () => {
  console.log("Running scheduled order job...");
  const now = new Date();
  const scheduledOrders = await ScheduledOrder.find({
    status: "Pending",
    startDate: { $lte: now },
    endDate: { $gte: now },
    time: { $lte: now },
  });

  for (const scheduledOrder of scheduledOrders) {
    await createOrdersFromScheduled(scheduledOrder);
  }
});

console.log("Scheduled order job started");

module.exports = {
  sortMerchantsBySponsorship,
  getDistanceFromPickupToDelivery,
  calculateDeliveryCharges,
  getTaxAmount,
  createOrdersFromScheduled,
};
