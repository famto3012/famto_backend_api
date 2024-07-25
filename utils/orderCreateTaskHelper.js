const appError = require("./appError");
const Task = require("../models/Task");
const turf = require("@turf/turf");
const AutoAllocation = require("../models/AutoAllocation");
const Order = require("../models/Order");
const Agent = require("../models/Agent");
const AgentPricing = require("../models/AgentPricing");
const Customer = require("../models/Customer");
const Merchant = require("../models/Merchant");
const {
  getRecipientSocketId,
  io,
  getRecipientFcmToken,
  sendNotification,
} = require("../socket/socket");
const BusinessCategory = require("../models/BusinessCategory");
const FcmToken = require("../models/fcmToken");
const AgentNotificationLogs = require("../models/AgentNotificationLog");

const orderCreateTaskHelper = async (orderId) => {
  try {
    const order = await Order.findById(orderId);
    let task = await Task.find({ orderId });

    if (order) {
      if (task.length === 0) {
        let pickupDetail = {
          pickupLocation: order.orderDetail.pickupLocation,
          pickupAddress: order.orderDetail.pickupAddress,
        };
        let deliveryDetail = {
          deliveryLocation: order.orderDetail.deliveryLocation,
          deliveryAddress: order.orderDetail.deliveryAddress,
        };
        await Task.create({
          orderId,
          deliveryMode: order.orderDetail.deliveryMode,
          pickupDetail,
          deliveryDetail,
        });
      }
    }

    task = await Task.find({ orderId });

    const autoAllocation = await AutoAllocation.findOne();

    if (autoAllocation.isActive) {
      if (autoAllocation.autoAllocationType === "All") {
        if (autoAllocation.priorityType === "Default") {
          await notifyAgents(order, autoAllocation.priorityType, io);
        } else {
          await notifyAgents(order, autoAllocation.priorityType, io);
        }
      } else {
        await notifyNearestAgents(
          order,
          autoAllocation.priorityType,
          autoAllocation.maxRadius,
          io
        );
      }
    }
    return true;
  } catch (err) {
    appError(err.message);
  }
};

const notifyAgents = async (order, priorityType, io) => {
  try {
    let agents;
    if (priorityType === "Default") {
      agents = await fetchAgents(order.merchantId);
    } else {
      agents = await fetchMonthlySalaryAgents(order.merchantId);
    }
    console.log("Agents", agents);
    const merchant = await Merchant.findById(order.merchantId);
    console.log("Merchant", merchant);
    const customer = await Customer.findById(order.customerId);
    console.log("Customer", customer);
    let deliveryAddress = order.orderDetail.deliveryAddress;
    console.log(deliveryAddress);
    console.log("Agents array length:", agents.length);
    for (const agent of agents) {
      console.log("Inside loop");
      console.log("AgentId", agent.id);
      const userToken = await FcmToken.find({ userId: agent.id });
      const fcmToken = userToken[0].token;
      console.log("FCM TOKEN", fcmToken);
      const socketId = await getRecipientSocketId(agent.id);
      console.log("SocketId", socketId);
      const data = {
        socket: {
          orderId: order.id,
          merchantName: order.orderDetail.pickupAddress.fullName,
          pickAddress: order.orderDetail.pickupAddress,
          customerName: deliveryAddress.fullName,
          customerAddress: deliveryAddress,
        },
        fcm: `New order for merchant with orderId ${order.id}`,
      };
      sendNotification(agent.id, "newOrder", data);
      const agentNotification = await AgentNotificationLogs.findOne({ orderId: order.id, agentId: agent.id });
      const pickupDetail = {
        name: order.orderDetail.pickupAddress.fullName,
        address: order.orderDetail.pickupAddress,
      }
      const deliveryDetail = {
        name: deliveryAddress.fullName,
        address: deliveryAddress,
      }
    if (agentNotification) {
      res.status(200).json({
        message: "Notification already send to the agent",
      });
    } else {
      await AgentNotificationLogs.create({
        orderId: order.id,
        agentId: agent.id,
        pickupDetail,
        deliveryDetail,
        orderType: order.orderDetail.deliveryMode,
      });
    }
    }
  } catch (err) {
    appError(err.message);
  }
};

const notifyNearestAgents = async (order, priorityType, maxRadius, io) => {
  try {
    let agents;
    if (priorityType === "Default") {
      agents = await fetchNearestAgents();
    } else {
      agents = await fetchNearestMonthlySalaryAgents(
        maxRadius,
        order.merchantId
      );
    }
    console.log("Agents", agents);
    const merchant = await Merchant.findById(order.merchantId);
    console.log("Merchant", merchant);
    const customer = await Customer.findById(order.customerId);
    console.log("Customer", customer);
    let deliveryAddress = order.orderDetail.deliveryAddress;
    console.log(deliveryAddress);
    console.log("Agents array length:", agents.length);
    for (const agent of agents) {
      console.log("Inside loop");
      console.log("AgentId", agent.id);
      const userToken = await FcmToken.find({ userId: agent.id });
      const fcmToken = userToken[0].token;
      console.log("FCM TOKEN", fcmToken);
      const socketId = await getRecipientSocketId(agent.id);
      console.log("SocketId", socketId);
      const data = {
        socket: {
          orderId: order.id,
          merchantName: order.orderDetail.pickupAddress.fullName,
          pickAddress: order.orderDetail.pickupAddress,
          customerName: deliveryAddress.fullName,
          customerAddress: deliveryAddress,
        },
        fcm: `New order for merchant with orderId ${order.id}`,
      };
      sendNotification(agent.id, "newOrder", data);
      const agentNotification = await AgentNotificationLogs.findOne({ orderId: order.id, agentId: agent.id });
      const pickupDetail = {
        name: order.orderDetail.pickupAddress.fullName,
        address: order.orderDetail.pickupAddress,
      }
      const deliveryDetail = {
        name: deliveryAddress.fullName,
        address: deliveryAddress,
      }
    if (agentNotification) {
      res.status(200).json({
        message: "Notification already send to the agent",
      });
    } else {
      await AgentNotificationLogs.create({
        orderId: order.id,
        agentId: agent.id,
        pickupDetail,
        deliveryDetail,
        orderType: order.orderDetail.deliveryMode,
      });
    }
    }
  } catch (err) {
    appError(err.message);
  }
};

const fetchMonthlySalaryAgents = async (merchantId) => {
  try {
    let merchant;
    let merchantBusinessCategory;
    if (merchantId) {
      merchant = await Merchant.findById(merchantId);
      merchantBusinessCategory = await BusinessCategory.findById(
        merchant.merchantDetail.businessCategoryId
      );
    }
    // Find the AgentPricing document where ruleName is "Monthly"
    const monthlySalaryPricing = await AgentPricing.findOne({
      ruleName: "Monthly-salaried",
    });
    //  console.log(monthlySalaryPricing._id)
    if (!monthlySalaryPricing) {
      throw new Error(`No pricing rule found for ruleName: "Monthly"`);
    }

    let agents;
    if (merchant) {
      if (
        merchantBusinessCategory.title === "Fish" ||
        merchantBusinessCategory.title === "Meat"
      ) {
        agents = await Agent.find({
          status: "Free",
          "workStructure.tag": "Fish & Meat",
          isApproved: "Approved"
        });
      } else {
        agents = await Agent.find({ status: "Free", isApproved: "Approved" });
      }
    } else {
      agents = await Agent.find({
        status: "Free",
        "workStructure.tag": { $ne: "Fish & Meat" },
        isApproved: "Approved"
      });
    }

    // Fetch all agents and filter those with the monthly salary structure ID

    const monthlySalaryAgents = agents.filter((agent) => {
      const agentSalaryStructureId =
        agent.workStructure.salaryStructureId.toString();
      const pricingId = monthlySalaryPricing._id.toString();
      // console.log(`Agent Salary Structure ID: ${agentSalaryStructureId}`);
      // console.log(`Monthly Salary Pricing ID for Comparison: ${pricingId}`);
      return agentSalaryStructureId === pricingId;
    });

    // console.log('Filtered Monthly Salary Agents:', monthlySalaryAgents);

    return monthlySalaryAgents;
  } catch (error) {
    console.error("Error fetching monthly salary agents:", error.message);
    throw error;
  }
};

const fetchNearestMonthlySalaryAgents = async (radius, merchantId) => {
  try {
    // Find the AgentPricing document where ruleName is "Monthly"
    const monthlySalaryPricing = await AgentPricing.findOne({
      ruleName: "Monthly-salaried",
    });

    //  console.log(monthlySalaryPricing._id)
    if (!monthlySalaryPricing) {
      throw new Error(`No pricing rule found for ruleName: "Monthly"`);
    }

    // Fetch all agents and filter those with the monthly salary structure ID
    let merchant;
    let merchantBusinessCategory;
    if (merchantId) {
      merchant = await Merchant.findById(merchantId);
      merchantBusinessCategory = await BusinessCategory.findById(
        merchant.merchantDetail.businessCategoryId
      );
    }
    let agents;
    if (merchant) {
      if (
        merchantBusinessCategory.title === "Fish" ||
        merchantBusinessCategory.title === "Meat"
      ) {
        agents = await Agent.find({
          status: "Free",
          "workStructure.tag": "Fish & Meat",
          isApproved: "Approved"
        });
      } else {
        agents = await Agent.find({ status: "Free", isApproved: "Approved" });
      }
    } else {
      agents = await Agent.find({
        status: "Free",
        "workStructure.tag": { $ne: "Fish & Meat" },
        isApproved: "Approved"
      });
    }
    console.log("Agents before distance filter", agents);
    const filteredAgents = agents.filter((agent) => {
      const maxRadius = radius;
      if (maxRadius > 0) {
        const merchantLocation = merchant.merchantDetail.location;
        const agentLocation = agent.location;
        const distance = turf.distance(
          turf.point(merchantLocation),
          turf.point(agentLocation),
          { units: "kilometers" }
        );
        console.log(distance);
        return distance <= maxRadius;
      }
      return true;
    });

    console.log("Agents after distance filter", filteredAgents);

    const monthlySalaryAgents = filteredAgents.filter((agent) => {
      const agentSalaryStructureId =
        agent.workStructure.salaryStructureId.toString();
      const pricingId = monthlySalaryPricing._id.toString();
      // console.log(`Agent Salary Structure ID: ${agentSalaryStructureId}`);
      // console.log(`Monthly Salary Pricing ID for Comparison: ${pricingId}`);
      return agentSalaryStructureId === pricingId;
    });

    // console.log('Filtered Monthly Salary Agents:', monthlySalaryAgents);

    return monthlySalaryAgents;
  } catch (error) {
    console.error("Error fetching monthly salary agents:", error.message);
    throw error;
  }
};

const fetchAgents = async (merchantId) => {
  let merchant;
  let merchantBusinessCategory;
  if (merchantId) {
    merchant = await Merchant.findById(merchantId);
    merchantBusinessCategory = await BusinessCategory.findById(
      merchant.merchantDetail.businessCategoryId
    );
  }
  let agents;
  if (merchant) {
    if (
      merchantBusinessCategory.title === "Fish" ||
      merchantBusinessCategory.title === "Meat"
    ) {
      agents = await Agent.find({
        status: "Free",
        "workStructure.tag": "Fish & Meat",
        isApproved: "Approved",
      });
    } else {
      agents = await Agent.find({ status: "Free", isApproved: "Approved" });
    }
  } else {
    agents = await Agent.find({
      status: "Free",
      "workStructure.tag": { $ne: "Fish & Meat" },
      isApproved: "Approved",
    });
  }
  return agents;
};

const fetchNearestAgents = async (merchantId) => {
  let merchant;
  let merchantBusinessCategory;
  if (merchantId) {
    merchant = await Merchant.findById(merchantId);
    merchantBusinessCategory = await BusinessCategory.findById(
      merchant.merchantDetail.businessCategoryId
    );
  }
  let agents;
  if (merchant) {
    if (
      merchantBusinessCategory.title === "Fish" ||
      merchantBusinessCategory.title === "Meat"
    ) {
      agents = await Agent.find({
        status: "Free",
        "workStructure.tag": "Fish & Meat",
        isApproved: "Approved",
      });
    } else {
      agents = await Agent.find({ status: "Free", isApproved: "Approved" });
    }
  } else {
    agents = await Agent.find({
      status: "Free",
      "workStructure.tag": { $ne: "Fish & Meat" },
      isApproved: "Approved"
    });
  }

  const filteredAgents = agents.filter((agent) => {
    const maxRadius = radius;
    if (maxRadius > 0) {
      const merchantLocation = merchant.merchantDetail.location;
      const agentLocation = agent.location;
      const distance = turf.distance(
        turf.point(merchantLocation),
        turf.point(agentLocation),
        { units: "kilometers" }
      );
      console.log(distance);
      return distance <= maxRadius;
    }
    return true;
  });
  return filteredAgents;
};

module.exports = { orderCreateTaskHelper };
