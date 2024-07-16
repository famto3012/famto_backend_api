const Agent = require("../../../models/Agent");
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

    const socketId =  userSocketMap[agentId]?.socketId;
   const task = await Task.findById(taskId)
   const data = {
    socket:{
      
    }
   }
   if(socketId){
     sendNotification(agentId, "newOrder", `New order for merchant with orderId ${task.orderId}`)
   }else{
     sendNotification(agentId, "newOrder", `New order for merchant with orderId ${task.orderId}`)
   }

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
