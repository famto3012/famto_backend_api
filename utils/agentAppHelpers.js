const formatLoginDuration = (milliseconds) => {
  const totalMinutes = Math.floor(milliseconds / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours && minutes) {
    return `${hours}:${minutes < 10 ? "0" : ""}${minutes} hr`;
  } else {
    return `0:00 hr`;
  }
};

const moveAppDetailToHistoryAndResetForAllAgents = async () => {
  try {
    console.log("Started moving App details to history for all agents");

    const Agent = require("../models/Agent");
    const agents = await Agent.find({ isApproved: "Approved" });

    for (const agent of agents) {
      // Calculate the login duration
      const currentTime = new Date();
      const loginDuration = currentTime - new Date(agent.loginStartTime); // in milliseconds

      // Update the agent's login duration
      agent.appDetail.loginDuration += loginDuration;

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

      // Update loginStartTime to the current time
      agent.loginStartTime = currentTime;

      await agent.save();
    }

    console.log("Finished moving App details to history for all agents");
  } catch (err) {
    console.log(
      `Error moving appDetail to history for all agents: ${err.message}`
    );
  }
};

const calculateSalaryChargeForAgent = (
  distance,
  baseFare,
  baseDistanceFare,
  extraFarePerDay,
  baseDistanceFarePerKM,
  purchaseFarePerHour
) => {
  if (distance <= baseDistance) {
    return parseFloat(baseFare);
  } else {
    return parseFloat(
      baseFare + (distance - baseDistance) * fareAfterBaseDistance
    );
  }
};

module.exports = {
  formatLoginDuration,
  moveAppDetailToHistoryAndResetForAllAgents,
  calculateSalaryChargeForAgent,
};
