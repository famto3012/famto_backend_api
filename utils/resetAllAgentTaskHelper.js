const Agent = require("../models/Agent");
const appError = require("./appError");

// Helper function to reset all agents' tasks to zero
const resetAllAgentTaskHelper = async () => {
  try {
    const agents = await Agent.find();
    for (const agent of agents) {
      agent.taskCompleted = 0;
      await agent.save();
    }
    console.log("All agents' tasks have been reset to zero.");
  } catch (err) {
    console.error("Error resetting agent tasks:", err.message);
  }
};

module.exports = { resetAllAgentTaskHelper };
