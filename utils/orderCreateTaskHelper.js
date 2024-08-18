const appError = require("./appError");
const Task = require("../models/Task");
const turf = require("@turf/turf");
const AutoAllocation = require("../models/AutoAllocation");
const Order = require("../models/Order");
const Agent = require("../models/Agent");
const AgentPricing = require("../models/AgentPricing");
const Merchant = require("../models/Merchant");
const { io, sendNotification } = require("../socket/socket");
const BusinessCategory = require("../models/BusinessCategory");
const FcmToken = require("../models/fcmToken");

const orderCreateTaskHelper = async (orderId) => {
  try {
    const order = await Order.findById(orderId);
    let task = await Task.find({ orderId });

    if (order) {
      if (task.length === 0) {
        let pickupDetail = {
          pickupLocation: order?.orderDetail?.pickupLocation,
          pickupAddress: order?.orderDetail?.pickupAddress,
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
    throw new Error(`Error in creating order task: ${err}`);
  }
};

const notifyAgents = async (order, priorityType) => {
  try {
    let agents;

    if (priorityType === "Default") {
      agents = await fetchAgents(order.merchantId);
    } else {
      agents = await fetchMonthlySalaryAgents(order.merchantId);
    }

    let deliveryAddress = order.orderDetail.deliveryAddress;

    console.log("Agents array length:", agents.length);
    for (const agent of agents) {
      const data = {
        socket: {
          orderId: order.id,
          merchantName: order.orderDetail.pickupAddress.fullName,
          pickAddress: order.orderDetail.pickupAddress,
          customerName: deliveryAddress.fullName,
          customerAddress: deliveryAddress,
        },
        fcm: {
          title: "New Order",
          body: "You have a new order to pickup",
          image: "",
          orderId: order.id,
          agentId: agent.id,
          pickupDetail: {
            name: order.orderDetail.pickupAddress.fullName,
            address: order.orderDetail.pickupAddress,
          },
          deliveryDetail: {
            name: deliveryAddress.fullName,
            address: deliveryAddress,
          },
          orderType: order.orderDetail.deliveryOption,
        },
      };

      const parameter = { user: "Agent", eventName: "newOrder" };

      sendNotification(agent.id, parameter.eventName, data, parameter.user);
    }
  } catch (err) {
    throw new Error(`Error in notifying agents: ${err}`);
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

    let deliveryAddress = order.orderDetail.deliveryAddress;

    for (const agent of agents) {
      const userToken = await FcmToken.find({ userId: agent.id });

      const data = {
        socket: {
          orderId: order.id,
          merchantName: order.orderDetail.pickupAddress.fullName,
          pickAddress: order.orderDetail.pickupAddress,
          customerName: deliveryAddress.fullName,
          customerAddress: deliveryAddress,
        },
        fcm: {
          title: "New Order",
          body: "You have a new order to pickup",
          image: "",
          orderId: order.id,
          agentId: agent.id,
          pickupDetail: {
            name: order.orderDetail.pickupAddress.fullName,
            address: order.orderDetail.pickupAddress,
          },
          deliveryDetail: {
            name: deliveryAddress.fullName,
            address: deliveryAddress,
          },
          orderType: order.orderDetail.deliveryOption,
        },
      };

      const parameter = { user: "Agent", eventName: "newOrder" };

      sendNotification(agent.id, parameter.eventName, data, parameter.user);
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

    // Fetch all agents and filter those with the monthly salary structure ID
    const monthlySalaryAgents = agents.filter((agent) => {
      const agentSalaryStructureId =
        agent.workStructure.salaryStructureId.toString();
      const pricingId = monthlySalaryPricing._id.toString();

      return agentSalaryStructureId === pricingId;
    });

    return monthlySalaryAgents;
  } catch (error) {
    throw new Error(`Error fetching monthly salary agents: ${err}`);
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

    const monthlySalaryAgents = filteredAgents.filter((agent) => {
      const agentSalaryStructureId =
        agent.workStructure.salaryStructureId.toString();
      const pricingId = monthlySalaryPricing._id.toString();

      return agentSalaryStructureId === pricingId;
    });

    return monthlySalaryAgents;
  } catch (error) {
    throw new Error(`Error fetching monthly salary agents: ${err}`);
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
      isApproved: "Approved",
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
