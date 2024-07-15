const Agent = require("../models/Agent");

const formatLoginDuration = (milliseconds) => {
  const totalMinutes = Math.floor(milliseconds / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${minutes < 10 ? "0" : ""}${minutes} hr`;
};

const moveAppDetailToHistoryAndResetForAllAgents = async () => {
  try {
    console.log("Started moving App details to history for all agents");

    const agents = await Agent.find({});

    for (const agent of agents) {
      // Move current appDetail to appDetailHistory
      agent.appDetailHistory.push({
        date: new Date(),
        details: { ...agent?.appDetail },
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

      await agent.save();
    }

    console.log("Finished moving App details to history for all agents");
  } catch (err) {
    console.log(
      `Error moving appDetail to history for all agents: ${err.message}`
    );
  }
};

module.exports = {
  formatLoginDuration,
  moveAppDetailToHistoryAndResetForAllAgents,
};
