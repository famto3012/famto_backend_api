const HomeScreenRealTimeData = require("../../../models/HomeScreenRealTimeData");
const HomeScreenRevenueData = require("../../../models/HomeScreenRevenueData");
const appError = require("../../../utils/appError");

const getHomeScreenRealTimeData = async (req, res, next) => {
  try {
    // Fetch the most recent HomeScreenRealTimeData entry
    const realTimeData = await HomeScreenRealTimeData.findOne();

    if (!realTimeData) {
      return res.status(404).json({ message: "No real-time data found" });
    }

    res.status(200).json(realTimeData);
  } catch (err) {
    next(appError(err.message));
  }
};

const createHomeScreenRealTimeData = async (req, res, next) => {
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
  } catch (err) {
    next(appError(err.message));
  }
};

const getRevenueDataByDateRange = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    console.log(req.query);

    // Convert to ISO strings for querying
    const start = new Date(startDate);
    const end = new Date(endDate);
    console.log("start date", start)
    console.log("end date", end)
    // Fetch data between the startDate and endDate
    const revenueData = await HomeScreenRevenueData.aggregate([
      {
        $match: {
          createdAt: {
            $gte: start,
            $lte: end,
          },
        },
      },
      {
        // Group by truncated date (to the day, ignoring time)
        $group: {
          _id: {
            $dateTrunc: {
              date: "$createdAt",
              unit: "day", // Truncate to the day, ignoring time
            },
          },
          sales: { $sum: "$sales" },
          merchants: { $sum: "$merchants" },
          commission: { $sum: "$commission" },
          subscription: { $sum: "$subscription" },
        },
      },
      {
        // Rename `_id` to `createdAt`
        $project: {
          _id: 0, // Exclude the default `_id` field
          createdAt: "$_id", // Rename `_id` to `createdAt`
          sales: 1,
          merchants: 1,
          commission: 1,
          subscription: 1,
        },
      },
      {
        // Optionally sort by date (ascending)
        $sort: { createdAt: 1 },
      },
    ]);
    console.log("revenue data", revenueData);

    // Send the response
    res.status(200).json(revenueData);
  } catch (err) {
    next(appError(err.message));
  }
};

const getRevenueDataByDateRangeForMerchant = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    // Convert to ISO strings for querying
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Fetch data between the startDate and endDate
    const revenueData = await HomeScreenRevenueData.find({
      createdAt: {
        $gte: start,
        $lte: end,
      },
      userId: req.userAuth,
    });

    // Send the response
    res.status(200).json(revenueData);
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  getHomeScreenRealTimeData,
  createHomeScreenRealTimeData,
  getRevenueDataByDateRange,
  getRevenueDataByDateRangeForMerchant,
};
