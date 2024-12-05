const Agent = require("../models/Agent");
const appError = require("./appError");

// Helper function to reset all agents' tasks to zero
const resetAllAgentTaskHelper = async (req, res, next) => {
  try {
    const agents = await Agent.find();
    for (const agent of agents) {
      agent.taskCompleted = 0;
      await agent.save();
    }
    res.status(200).send("All agents' tasks have been reset to zero.");
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = { resetAllAgentTaskHelper };
