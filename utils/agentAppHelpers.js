const AgentNotificationLogs = require("../models/AgentNotificationLog");
const AgentPricing = require("../models/AgentPricing");
const Customer = require("../models/Customer");
const CustomerPricing = require("../models/CustomerPricing");
const Referral = require("../models/Referral");
const SubscriptionLog = require("../models/SubscriptionLog");
const Task = require("../models/Task");
const {
  getDistanceFromPickupToDelivery,
  calculateDeliveryCharges,
} = require("./customerAppHelpers");

const formatToHours = (milliseconds) => {
  const totalMinutes = Math.floor(milliseconds / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  // Format the hours and minutes for readability
  const hoursFormatted = hours > 0 ? `${hours} h ` : "";
  const minutesFormatted = minutes > 0 ? `${minutes} min` : "";

  // If both hours and minutes are zero, return '0m'
  return hoursFormatted + (minutesFormatted || "0 min");
};

const moveAppDetailToHistoryAndResetForAllAgents = async () => {
  try {
    const Agent = require("../models/Agent");
    const AgentPricing = require("../models/AgentPricing");
    const mongoose = require("mongoose");

    const agents = await Agent.find({ isApproved: "Approved" })
      .lean()
      .select([
        "_id",
        "appDetail",
        "loginStartTime",
        "workStructure.salaryStructureId",
        "status",
      ]);

    const currentTime = new Date();
    const lastDay = new Date();
    lastDay.setDate(lastDay.getDate() - 1);

    const bulkOperations = [];

    for (const agent of agents) {
      // Initialize appDetail if not present
      const appDetail = agent.appDetail || {
        totalEarning: 0,
        orders: 0,
        pendingOrders: 0,
        totalDistance: 0,
        cancelledOrders: 0,
        loginDuration: 0,
      };

      // Calculate login duration
      const loginDuration =
        currentTime - new Date(agent?.loginStartTime || currentTime);
      appDetail.loginDuration += loginDuration;

      // Fetch agent pricing only once per agent
      const agentPricing = await AgentPricing.findById(
        agent.workStructure.salaryStructureId
      ).lean();

      if (agentPricing) {
        const minLoginMillis = agentPricing.minLoginHours * 60 * 60 * 1000;

        if (
          appDetail.loginDuration >= minLoginMillis &&
          appDetail.orders >= agentPricing.minOrderNumber &&
          appDetail.orders > agentPricing.minOrderNumber
        ) {
          // Calculate extra order earnings
          const earningForExtraOrders =
            (appDetail.orders - agentPricing.minOrderNumber) *
            agentPricing.fareAfterMinOrderNumber;

          appDetail.totalEarning += earningForExtraOrders;
        }

        // Calculate extra login hours earnings
        const extraMillis = appDetail.loginDuration - minLoginMillis;

        if (
          appDetail.loginDuration >= minLoginMillis &&
          appDetail.orders >= agentPricing.minOrderNumber &&
          extraMillis > 0
        ) {
          const extraHours = Math.floor(extraMillis / (60 * 60 * 1000));
          if (extraHours >= 1) {
            const earningForExtraHours =
              extraHours * agentPricing.fareAfterMinLoginHours;

            appDetail.totalEarning += earningForExtraHours;
          }
        }

        if (
          appDetail.loginDuration >= minLoginMillis &&
          appDetail.orders >= agentPricing.minOrderNumber &&
          appDetail.totalEarning < agentPricing.baseFare
        ) {
          appDetail.totalEarning = agentPricing.baseFare;
        }
      }

      // Prepare the history and reset update
      const update = {
        $push: {
          appDetailHistory: {
            date: lastDay,
            details: { ...appDetail },
            detailId: new mongoose.Types.ObjectId(),
          },
        },
        $set: {
          "appDetail.totalEarning": 0,
          "appDetail.orders": 0,
          "appDetail.pendingOrders": 0,
          "appDetail.totalDistance": 0,
          "appDetail.cancelledOrders": 0,
          "appDetail.loginDuration": 0,
          loginStartTime:
            agent.status !== "Inactive" ? currentTime : agent.loginStartTime,
        },
      };

      bulkOperations.push({
        updateOne: {
          filter: { _id: agent._id },
          update,
        },
      });
    }

    // Perform bulk write operation
    if (bulkOperations.length > 0) {
      await Agent.bulkWrite(bulkOperations);
    }
  } catch (err) {
    console.log(
      `Error moving appDetail to history for all agents: ${err.message}`
    );
  }
};

const updateLoyaltyPoints = (customer, criteria, orderAmount) => {
  if (!criteria || !orderAmount || orderAmount <= 0) {
    console.error("Invalid criteria or orderAmount.");
    return;
  }

  const {
    earningCriteriaRupee,
    earningCriteriaPoint,
    maxEarningPointPerOrder,
  } = criteria;

  let loyaltyPointEarnedToday =
    customer.customerDetails?.loyaltyPointEarnedToday || 0;

  // Calculate points for the current order
  const calculatedPoints =
    Math.floor(orderAmount / earningCriteriaRupee) * earningCriteriaPoint;

  // Cap points at maxEarningPointPerOrder if it exceeds
  const pointsOfOrder = Math.min(calculatedPoints, maxEarningPointPerOrder);

  loyaltyPointEarnedToday += pointsOfOrder;

  // Update customer details
  customer.customerDetails.loyaltyPointEarnedToday = loyaltyPointEarnedToday;
  customer.customerDetails.loyaltyPointLeftForRedemption += pointsOfOrder;
  customer.customerDetails.totalLoyaltyPointEarned += pointsOfOrder;

  // Add new loyalty point entry
  customer.loyaltyPointDetails.push({
    earnedOn: new Date(),
    point: pointsOfOrder,
  });
};

const processReferralRewards = async (customer, orderAmount) => {
  const referralType = customer?.referralDetail?.referralType;
  const referralFound = await Referral.findOne({ referralType });

  const now = new Date();
  const registrationDate = new Date(customer.createdAt);

  const durationInDays = Math.floor(
    (now - registrationDate) / (1000 * 60 * 60 * 24)
  );

  if (durationInDays > 7) return;

  if (!referralFound || orderAmount < referralFound.minOrderAmount) return;

  const referrerFound = await Customer.findById(
    customer?.referralDetail?.referrerUserId
  );

  const {
    referrerDiscount,
    refereeDiscount,
    referrerMaxDiscountValue,
    refereeMaxDiscountValue,
  } = referralFound;

  if (referralType === "Flat-discount") {
    let referrerTransation = {
      madeOn: new Date(),
      transactionType: "Referal",
      transactionAmount: parseFloat(referrerDiscount),
      type: "Credit",
    };

    let customerTransation = {
      madeOn: new Date(),
      transactionType: "Referal",
      transactionAmount: parseFloat(refereeDiscount),
      type: "Credit",
    };

    referrerFound.customerDetails.walletBalance += parseFloat(referrerDiscount);
    referrerFound.transactionDetail.push(referrerTransation);

    customer.customerDetails.walletBalance += parseFloat(refereeDiscount);
    customer.transactionDetail.push(customerTransation);
  } else if (referralType === "Percentage-discount") {
    const referrerAmount = Math.min(
      (orderAmount * referrerDiscount) / 100,
      referrerMaxDiscountValue
    );
    const refereeAmount = Math.min(
      (orderAmount * refereeDiscount) / 100,
      refereeMaxDiscountValue
    );

    let referrerTransation = {
      madeOn: new Date(),
      transactionType: "Referal",
      transactionAmount: parseFloat(referrerAmount),
      type: "Credit",
    };

    let customerTransation = {
      madeOn: new Date(),
      transactionType: "Referal",
      transactionAmount: parseFloat(refereeAmount),
      type: "Credit",
    };

    referrerFound.customerDetails.walletBalance += parseFloat(referrerAmount);
    referrerFound.transactionDetail.push(referrerTransation);

    customer.customerDetails.walletBalance += parseFloat(refereeAmount);
    customer.transactionDetail.push(customerTransation);
  }

  customer.referralDetail.processed = true;

  await Promise.all([referrerFound.save(), customer.save()]);
};

const calculateAgentEarnings = async (agent, order) => {
  const agentPricing = await AgentPricing.findById(
    agent?.workStructure?.salaryStructureId
  );

  if (!agentPricing) throw new Error("Agent pricing not found");

  let orderSalary =
    order.orderDetail.detailAddedByAgent.distanceCoveredByAgent *
    agentPricing.baseDistanceFarePerKM;

  let totalPurchaseFare = 0;

  if (order.orderDetail.deliveryMode === "Custom Order") {
    const taskFound = await Task.findOne({ orderId: order._id });
    if (taskFound) {
      const durationInHours =
        (new Date(taskFound?.deliveryDetail?.startTime) -
          new Date(taskFound.pickupDetail.startTime)) /
        (1000 * 60 * 60);

      const normalizedHours =
        durationInHours < 1 ? 1 : Math.floor(durationInHours);

      totalPurchaseFare = normalizedHours * agentPricing.purchaseFarePerHour;
    }
  }

  const totalEarnings = orderSalary + totalPurchaseFare;

  // Use parseFloat to ensure it's a number with two decimal places
  return parseFloat(totalEarnings.toFixed(2));
};

const updateOrderDetails = (order, calculatedSalary) => {
  const currentTime = new Date();
  let delayedBy = null;

  if (currentTime > new Date(order.orderDetail.deliveryTime)) {
    delayedBy = currentTime - new Date(order.orderDetail.deliveryTime);
  }

  order.status = "Completed";
  order.paymentStatus = "Completed";
  order.orderDetail.deliveryTime = currentTime;
  order.orderDetail.timeTaken =
    currentTime - new Date(order.orderDetail.agentAcceptedAt);
  order.orderDetail.delayedBy = delayedBy;

  if (!order?.detailAddedByAgent) order.detailAddedByAgent = {};

  order.detailAddedByAgent.agentEarning = calculatedSalary;
};

const updateAgentDetails = async (
  agent,
  order,
  calculatedSalary,
  isOrderCompleted
) => {
  if (isOrderCompleted) {
    agent.appDetail.orders += 1;
  } else {
    agent.appDetail.cancelledOrders += 1;
  }

  agent.appDetail.totalEarning += parseFloat(calculatedSalary);
  agent.appDetail.totalDistance += parseFloat(
    order.orderDetail.distance.toFixed(2)
  );

  agent.appDetail.orderDetail.push({
    orderId: order._id,
    deliveryMode: order?.orderDetail?.deliveryMode,
    customerName: order?.orderDetail?.deliveryAddress?.fullName,
    completedOn: new Date(),
    grandTotal: order?.billDetail?.grandTotal,
  });

  const agentTasks = await Task.find({
    taskStatus: "Assigned",
    agentId: agent._id,
  }).sort({
    createdAt: 1,
  });

  agentTasks.length > 0 ? (agent.status = "Busy") : (agent.status = "Free");
};

const updateNotificationStatus = async (orderId) => {
  try {
    const notificationFound = await AgentNotificationLogs.findOne({
      orderId,
      status: "Accepted",
    });

    if (!notificationFound) throw new Error("Notification not found");

    notificationFound.status = "Completed";

    await notificationFound.save();
  } catch (err) {
    throw new Error(`Error in updating notification: ${err}`);
  }
};

const updateCustomerSubscriptionCount = async (customerId) => {
  try {
    const subscriptionOfCustomer = await Customer.findById(customerId).select(
      "customerDetails.pricing"
    );

    if (subscriptionOfCustomer?.customerDetails?.pricing?.length > 0) {
      const subscriptionLog = await SubscriptionLog.findById(
        subscriptionOfCustomer.customerDetails.pricing[0]
      );

      if (subscriptionLog) {
        subscriptionLog.currentNumberOfOrders += 1;

        await subscriptionLog.save();
      }
    }
  } catch (err) {
    throw new Error("Error in updating subscription count of customer");
  }
};

const updateBillOfCustomOrderInDelivery = async (order, task) => {
  try {
    const reachedPickupAt = task?.pickupDetail?.completedTime;
    const deliveryStartAt = task?.deliveryDetail?.startTime;
    const now = new Date();

    let calculatedWaitingFare = 0;
    let totalDistance = order?.orderDetail?.distance;

    const customerPricing = await CustomerPricing.findOne({
      deliveryMode: "Custom Order",
      geofenceId: order?.customerId?.customerDetails?.geofenceId,
      status: true,
    });

    if (!customerPricing) {
      return socket.emit("error", {
        message: `Customer pricing for custom order not found`,
        success: false,
      });
    }

    const {
      baseFare,
      baseDistance,
      fareAfterBaseDistance,
      waitingFare,
      waitingTime,
    } = customerPricing;

    const deliveryCharge = calculateDeliveryCharges(
      totalDistance,
      baseFare,
      baseDistance,
      fareAfterBaseDistance
    );

    const minutesWaitedAtPickup = Math.floor(
      (new Date(deliveryStartAt) - new Date(reachedPickupAt)) / 60000
    );

    if (minutesWaitedAtPickup > waitingTime) {
      const additionalMinutes = Math.round(minutesWaitedAtPickup - waitingTime);
      calculatedWaitingFare = parseFloat(waitingFare * additionalMinutes);
    }

    const totalTaskTime = new Date(now) - new Date(pickupStartAt);

    // Convert the difference to minutes
    const diffInHours = Math.ceil(totalTaskTime / 3600000);

    let calculatedPurchaseFare = 0;

    if (diffInHours > 0) {
      calculatedPurchaseFare = parseFloat(
        (diffInHours * customerPricing.purchaseFarePerHour).toFixed(2)
      );
    }

    const calculatedDeliveryFare =
      deliveryCharge + calculatedPurchaseFare + calculatedWaitingFare;

    order.billDetail.waitingCharges = calculatedDeliveryFare;
    order.billDetail.deliveryCharge = calculatedDeliveryFare;
    order.billDetail.grandTotal += calculatedDeliveryFare;
    order.billDetail.subTotal += calculatedDeliveryFare;
  } catch (err) {
    return socket.emit("error", {
      message: `Error in updating bill ${err}`,
      success: false,
    });
  }
};

module.exports = {
  formatToHours,
  moveAppDetailToHistoryAndResetForAllAgents,
  updateLoyaltyPoints,
  processReferralRewards,
  calculateAgentEarnings,
  updateOrderDetails,
  updateAgentDetails,
  updateNotificationStatus,
  updateCustomerSubscriptionCount,
  updateBillOfCustomOrderInDelivery,
};
