const Agent = require("../../../models/Agent");
const Task = require("../../../models/Task");

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

module.exports = { getTaskFilterController, getAgentByStatusController };
