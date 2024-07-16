const Agent = require("../../../models/Agent");
const Customer = require("../../../models/Customer");
const Merchant = require("../../../models/Merchant");
const Order = require("../../../models/Order");
const Task = require("../../../models/Task");
const { io, userSocketMap, sendNotification } = require("../../../socket/socket");
const appError = require("../../../utils/appError");

const getTaskFilterController = async (req, res, next) => {
  try {
    const { filter } = req.query;
    let task;
    if (filter === "Assigned") {
      task = await Task.find({ taskStatus: "Assigned" });
    } else if (filter === "Completed") {
      task = await Task.find({ deliveryStatus: "Completed" });
    } else {
      task = await Task.find({ taskStatus: "Unassigned" });
    }
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
      agent = await Agent.find({ status: "Free" });
    } else if (filter === "Busy") {
      agent = await Agent.find({ status: "Busy" });
    } else {
      agent = await Agent.find({ status: "Inactive" });
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

   const task = await Task.findById(taskId)
   const order = await Order.findById(task.orderId)
   const merchant = await Merchant.findById(order.merchantId)
   const customer = await Customer.findById(order.customerId)
   let deliveryAddress = order.orderDetail.deliveryAddress;
   const data = {
    socket:{
      orderId: order.id,
      merchantName: merchant.merchantDetail.merchantName,
      pickAddress: merchant.merchantDetail.displayAddress,
      customerName: customer.fullName,
      customerAddress: deliveryAddress,
    },
    fcm: `New order for merchant with orderId ${task.orderId}`
   }
     sendNotification(agentId, "newOrder", data)

   res.status(200).json({
    message: "Notification send to the agent"
   })

  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  getTaskFilterController,
  getAgentByStatusController,
  assignAgentToTaskController,
};
