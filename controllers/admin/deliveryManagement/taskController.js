const Agent = require("../../../models/Agent");
const Customer = require("../../../models/Customer");
const Geofence = require("../../../models/Geofence");
const Merchant = require("../../../models/Merchant");
const Order = require("../../../models/Order");
const Task = require("../../../models/Task");
const {
  io,
  userSocketMap,
  sendNotification,
} = require("../../../socket/socket");
const turf = require("@turf/turf");
const appError = require("../../../utils/appError");
const {
  getDistanceFromPickupToDelivery,
} = require("../../../utils/customerAppHelpers");
const AgentNotificationLogs = require("../../../models/AgentNotificationLog");

const getTaskFilterController = async (req, res, next) => {
  try {
    const { filter } = req.query;
    let taskQuery;

    if (filter === "Assigned") {
      taskQuery = Task.find({ taskStatus: "Assigned" });
    } else if (filter === "Completed") {
      taskQuery = Task.find({ deliveryStatus: "Completed" });
    } else {
      taskQuery = Task.find({ taskStatus: "Unassigned" });
    }

    // Populate the agentId and orderId fields
    taskQuery = taskQuery.populate("agentId").populate("orderId");

    const task = await taskQuery;

    res.status(201).json({
      message: "Task fetched successfully",
      data: task,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAgentByStatusController = async (req, res, next) => {
  try {
    const { filter } = req.query;

    let agent;
    if (filter === "Free") {
      agent = await Agent.find({ status: "Free", isApproved: "Approved" });
    } else if (filter === "Busy") {
      agent = await Agent.find({ status: "Busy", isApproved: "Approved" });
    } else {
      agent = await Agent.find({ status: "Inactive", isApproved: "Approved" });
    }

    res.status(201).json({
      message: "Agent fetched successfully",
      data: agent,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const assignAgentToTaskController = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { agentId } = req.body;

    const task = await Task.findById(taskId);
    const order = await Order.findById(task.orderId);
    const merchant = await Merchant.findById(order.merchantId);
    const customer = await Customer.findById(order.customerId);
    let deliveryAddress = order.orderDetail.deliveryAddress;
    const data = {
      socket: {
        orderId: order.id,
        merchantName: order.orderDetail.pickupAddress.fullName,
        pickAddress: order.orderDetail.pickupAddress,
        customerName: deliveryAddress.fullName,
        customerAddress: deliveryAddress,
      },
      fcm: `New order for merchant with orderId ${task.orderId}`,
    };
    sendNotification(agentId, "newOrder", data);
    const pickupDetail = {
      name: order.orderDetail.pickupAddress.fullName,
      address: order.orderDetail.pickupAddress,
    }
    const deliveryDetail = {
      name: deliveryAddress.fullName,
      address: deliveryAddress,
    }
    const agentNotification = await AgentNotificationLogs.findOne({ orderId: order.id, agentId: agentId });
    if (agentNotification) {
      res.status(200).json({
        message: "Notification already send to the agent",
      });
    } else {
      await AgentNotificationLogs.create({
        orderId: order.id,
        agentId: agentId,
        pickupDetail,
        deliveryDetail,
        orderType: order.orderDetail.deliveryMode,
      });
    }
   
    res.status(200).json({
      message: "Notification send to the agent",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAgentsAccordingToGeofenceController = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { geofenceStatus } = req.body;
    const task = await Task.findById(taskId).populate({
      path: "orderId",
      populate: {
        path: "merchantId",
        populate: {
          path: "merchantDetail.geofenceId",
        },
      },
    });
    console.log(task);
    let geofence;
    const agents = await Agent.find({ isApproved: "Approved" });

    if (task.orderId.orderDetail.deliveryMode === "Custom Order") {
      const deliveryLocation = task.orderId.orderDetail.pickupLocation;
      const responseData = await Promise.all(
        agents.map(async (agent) => {
          console.log("agent", agent.location);
          const { distanceInKM } = await getDistanceFromPickupToDelivery(
            agent.location,
            deliveryLocation
          );
          return {
            _id: agent._id,
            name: agent.fullName,
            workStructure: agent.workStructure.tag,
            status: agent.status,
            distance: distanceInKM, // distance in kilometers, rounded to 2 decimal places
          };
        })
      );

      res.status(200).json({
        success: true,
        data: responseData,
      });
    }

    if (task.orderId.orderDetail.deliveryMode === "Pick and Drop") {
      const deliveryLocation = task.orderId.orderDetail.pickupLocation;
      const responseData = await Promise.all(
        agents.map(async (agent) => {
          const { distanceInKM } = await getDistanceFromPickupToDelivery(
            agent.location,
            deliveryLocation
          );
          return {
            _id: agent._id,
            name: agent.fullName,
            workStructure: agent.workStructure.tag,
            status: agent.status,
            distance: distanceInKM, // distance in kilometers, rounded to 2 decimal places
          };
        })
      );

      res.status(200).json({
        success: true,
        data: responseData,
      });
    }
    const merchantLocation = task.orderId.merchantId.merchantDetail.location;
    geofence = task.orderId.merchantId.merchantDetail.geofenceId;
    const coordinates = geofence.coordinates;

    if (coordinates[0] !== coordinates[coordinates.length - 1]) {
      coordinates.push(coordinates[0]);
    }

    const geofencePolygon = turf.polygon([coordinates]);

    if (geofenceStatus) {
      const agentsWithinGeofence = agents.filter((agent) => {
        const agentPoint = turf.point(agent.location);
        return turf.booleanPointInPolygon(agentPoint, geofencePolygon);
      });

      const responseData = await Promise.all(
        agentsWithinGeofence.map(async (agent) => {
          const { distanceInKM } = await getDistanceFromPickupToDelivery(
            agent.location,
            merchantLocation
          );
          return {
            _id: agent._id,
            name: agent.fullName,
            workStructure: agent.workStructure.tag,
            status: agent.status,
            distance: distanceInKM, // distance in kilometers, rounded to 2 decimal places
          };
        })
      );
      console.log(responseData);
      // Return the found agents
      res.status(200).json({
        success: true,
        data: responseData,
      });
    } else {
      const responseData = await Promise.all(
        agents.map(async (agent) => {
          const { distanceInKM } = await getDistanceFromPickupToDelivery(
            agent.location,
            merchantLocation
          );
          return {
            _id: agent._id,
            name: agent.fullName,
            workStructure: agent.workStructure.tag,
            status: agent.status,
            distance: distanceInKM, // distance in kilometers, rounded to 2 decimal places
          };
        })
      );

      res.status(200).json({
        success: true,
        data: responseData,
      });
    }
  } catch (err) {
    next(appError(err.message));
  }
};

const getOrderByOrderIdController = async (req, res, next) => {
  try {
    const { orderId } = req.query;
    const order = await Task.find({ orderId });
    console.log(order);
    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAgentByNameController = async (req, res, next) => {
  try {
    const { fullName } = req.query;
    if (!fullName) {
      return res.status(400).json({ message: "Full name is required" });
    }

    const agents = await Agent.find({
      fullName: new RegExp(fullName, "i"),
      isApproved: "Approved", // Case-insensitive search
    });

    if (agents.length === 0) {
      return res.status(404).json({ message: "No agents found" });
    }

    res.status(200).json(agents);
  } catch (error) {
    next(appError(err.message));
  }
};

const getSingleTaskController = async (req, res, next) => {};

module.exports = {
  getTaskFilterController,
  getAgentByStatusController,
  assignAgentToTaskController,
  getAgentsAccordingToGeofenceController,
  getOrderByOrderIdController,
  getAgentByNameController,
};
