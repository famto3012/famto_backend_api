const { default: mongoose } = require("mongoose");
const AgentNotificationLogs = require("../models/AgentNotificationLog");
const AgentPricing = require("../models/AgentPricing");
const Customer = require("../models/Customer");
const Referral = require("../models/Referral");
const SubscriptionLog = require("../models/SubscriptionLog");
const Task = require("../models/Task");

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
    console.log("Started moving App details to history for all agents");

    const Agent = require("../models/Agent");
    const agents = await Agent.find({ isApproved: "Approved" });

    for (const agent of agents) {
      // Initialize appDetail if it's undefined
      if (!agent.appDetail) {
        agent.appDetail = {
          totalEarning: 0,
          orders: 0,
          pendingOrder: 0,
          totalDistance: 0,
          cancelledOrders: 0,
          loginDuration: 0,
        };
      }

      // Calculate the login duration
      const currentTime = new Date();
      const loginDuration =
        currentTime - new Date(agent?.loginStartTime || currentTime); // in milliseconds

      // Update the agent's login duration
      agent.appDetail.loginDuration += loginDuration;

      const lastDay = new Date();
      lastDay.setDate(lastDay.getDate() - 1);

      // Move current appDetail to appDetailHistory
      agent.appDetailHistory.push({
        date: lastDay,
        details: { ...agent?.appDetail },
        detailId: new mongoose.Types.ObjectId(),
      });

      // Reset appDetail
      agent.appDetail = {
        totalEarning: 0,
        orders: 0,
        pendingOrder: 0,
        totalDistance: 0,
        cancelledOrders: 0,
        loginDuration: 0,
      };

      if (agent.status !== "Inactive") {
        // Update loginStartTime to the current time
        agent.loginStartTime = currentTime;
      }

      await agent.save();
    }

    console.log("Finished moving App details to history for all agents");
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
  const agentPricing = await AgentPricing.findOne({
    status: true,
    geofenceId: agent.geofenceId,
  });

  if (!agentPricing) throw new Error("Agent pricing not found");

  let orderSalary =
    order.orderDetail.distance * agentPricing.baseDistanceFarePerKM;

  let totalPurchaseFare = 0;

  if (order.orderDetail.deliveryMode === "Custom Order") {
    const taskFound = await Task.findOne({ orderId: order._id });
    if (taskFound) {
      const durationInHours =
        (new Date(taskFound.endTime) - new Date(taskFound.startTime)) /
        (1000 * 60 * 60);
      totalPurchaseFare = durationInHours * agentPricing.purchaseFarePerHour;
    }
  }

  return parseFloat(orderSalary + totalPurchaseFare).toFixed(2);
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

  if (!order.detailAddedByAgent) {
    order.detailAddedByAgent = {};
  }

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
  agent.appDetail.totalDistance += order.orderDetail.distance;

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

  if (agentTasks.length > 0) {
    agentTasks[0].pickupDetail.pickupStatus = "Started";
    agentTasks[0].startTime = new Date();

    // await agentTasks.save();
  }
};

const updateNotificationStatus = async (orderId) => {
  try {
    const notificationFound = await AgentNotificationLogs.findOne({
      orderId,
      status: "Accepted",
    });

    if (!notificationFound) {
      throw new Error("Notification not found");
    }

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
};
