const Agent = require("../../../models/Agent");
const Order = require("../../../models/Order");
const Task = require("../../../models/Task");
const {
  sendNotification,
  findRolesToNotify,
  sendSocketData,
} = require("../../../socket/socket");
const turf = require("@turf/turf");
const appError = require("../../../utils/appError");
const {
  getDistanceFromPickupToDelivery,
} = require("../../../utils/customerAppHelpers");
const { formatDate, formatTime } = require("../../../utils/formatters");
const AutoAllocation = require("../../../models/AutoAllocation");

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
    const agent = await Agent.findById(agentId);
    const autoAllocation = await AutoAllocation.findOne();
    agent.appDetail.pendingOrder += 1;

    await agent.save();

    let deliveryAddress = order.orderDetail.deliveryAddress;

    const eventName = "newOrder";

    const { rolesToNotify, data } = await findRolesToNotify(eventName);

    // Send notifications to each role dynamically
    for (const role of rolesToNotify) {
      let roleId;

      if (role === "admin") {
        roleId = process.env.ADMIN_ID;
      } else if (role === "merchant") {
        roleId = order?.merchantId;
      } else if (role === "driver") {
        roleId = agentId;
      } else if (role === "customer") {
        roleId = order?.customerId;
      }

      if (roleId) {
        const notificationData = {
          fcm: {
            ...data,
            agentId,
            orderId: order._id,
            orderType: order.orderDetail.deliveryOption,
            pickupDetail: order?.orderDetail?.pickupAddress,
            deliveryDetail: order.orderDetail.deliveryAddress,
          },
        };

        await sendNotification(
          roleId,
          eventName,
          notificationData,
          role.charAt(0).toUpperCase() + role.slice(1)
        );
      }
    }

    const socketData = {
      ...data,
      orderId: order._id,
      merchantName: order.orderDetail.pickupAddress.fullName,
      pickAddress: order.orderDetail.pickupAddress,
      customerName: deliveryAddress.fullName,
      customerAddress: deliveryAddress,
      agentId,
      orderType: order.orderDetail.deliveryOption,
      taskDate: formatDate(new Date()),
      taskTime: formatTime(new Date()),
      timer: autoAllocation.expireTime,
    };

    sendSocketData(agentId, eventName, socketData);

    res.status(200).json({
      message: "Notification send to the agent",
      data: socketData,
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

    let geofence;
    const agents = await Agent.find({ isApproved: "Approved" });

    if (task?.orderId?.orderDetail?.deliveryMode === "Custom Order") {
      const deliveryLocation = task?.orderId?.orderDetail?.pickupLocation;
      const responseData = await Promise.all(
        agents.map(async (agent) => {
          console.log("agent", agent.location);
          const { distanceInKM } = await getDistanceFromPickupToDelivery(
            agent.location,
            deliveryLocation
          );
          return {
            _id: agent?._id,
            name: agent?.fullName,
            workStructure: agent?.workStructure?.tag,
            status: agent?.status,
            distance: distanceInKM, // distance in kilometers, rounded to 2 decimal places
          };
        })
      );

      res.status(200).json({
        success: true,
        data: responseData,
      });
    }

    if (task?.orderId?.orderDetail?.deliveryMode === "Pick and Drop") {
      const deliveryLocation = task?.orderId?.orderDetail?.pickupLocation;
      const responseData = await Promise.all(
        agents.map(async (agent) => {
          const { distanceInKM } = await getDistanceFromPickupToDelivery(
            agent.location,
            deliveryLocation
          );
          return {
            _id: agent?._id,
            name: agent?.fullName,
            workStructure: agent?.workStructure?.tag,
            status: agent?.status,
            distance: distanceInKM, // distance in kilometers, rounded to 2 decimal places
          };
        })
      );

      res.status(200).json({
        success: true,
        data: responseData,
      });
    }
    const merchantLocation =
      task?.orderId?.merchantId?.merchantDetail?.location;
    geofence = task?.orderId?.merchantId?.merchantDetail?.geofenceId;
    const coordinates = geofence?.coordinates;

    if (coordinates[0] !== coordinates[coordinates?.length - 1]) {
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
            workStructure: agent?.workStructure?.tag,
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
            workStructure: agent?.workStructure?.tag,
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
    const { orderId } = req.body;

    console.log(orderId);
    const order = await Task.find({
      orderId: { $regex: orderId, $options: "i" },
    });

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

const getTaskByDateRangeController = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    console.log(startDate,endDate)
    // Convert to ISO strings for querying
    const start = new Date(startDate);
    const end = new Date(endDate);
    console.log(start,end)
    // Fetch data between the startDate and endDate
    const taskData = await Task.find({
      createdAt: {
        $gte: start,
        $lte: end,
      },
    });

    // Send the response
    res.status(200).json(taskData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getTaskFilterController,
  getAgentByStatusController,
  assignAgentToTaskController,
  getAgentsAccordingToGeofenceController,
  getOrderByOrderIdController,
  getAgentByNameController,
  getTaskByDateRangeController,
};
