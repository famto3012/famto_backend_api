const HomeScreenRealTimeData = require("../../../models/HomeScreenRealTimeData");

const getHomeScreenRealTimeData = async (req, res) => {
  try {
    // Fetch the most recent HomeScreenRealTimeData entry
    const realTimeData = await HomeScreenRealTimeData.findOne();

    if (!realTimeData) {
      return res.status(404).json({ message: "No real-time data found" });
    }

    res.status(200).json(realTimeData);
  } catch (error) {
    console.error("Error fetching real-time data:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const createHomeScreenRealTimeData = async (req, res) => {
  try {
    // Extract data from the request body
    const { order, merchants, deliveryAgent } = req.body;

    // Create a new HomeScreenRealTimeData instance
    const newRealTimeData = new HomeScreenRealTimeData({
      order,
      merchants,
      deliveryAgent,
    });

    // Save the new entry to the database
    await newRealTimeData.save();

    res.status(201).json({
      message: "Home screen real-time data created successfully",
      data: newRealTimeData,
    });
  } catch (error) {
    console.error("Error creating real-time data:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { getHomeScreenRealTimeData, createHomeScreenRealTimeData };
