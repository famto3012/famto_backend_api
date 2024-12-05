const CommissionLogs = require("../models/CommissionLog");
const HomeScreenRevenueData = require("../models/HomeScreenRevenueData");
const Merchant = require("../models/Merchant");
const Order = require("../models/Order");
const SubscriptionLog = require("../models/SubscriptionLog");
const moment = require("moment-timezone");

async function fetchPerDayRevenue(date) {
  try {
    // Start and end of the day
    const previousDay = moment.tz(date, "Asia/Kolkata").subtract(1, "day");

    // Start and end of the previous day in IST
    const startOfDay = previousDay.startOf("day").toDate();
    const endOfDay = previousDay.endOf("day").toDate();

    // Fetch total sales from Orders
    let totalSales = [];
    try {
      totalSales = await Order.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfDay, $lte: endOfDay },
            status: { $ne: "Cancelled" }, // Exclude cancelled orders
          },
        },
        {
          $group: {
            _id: null,
            totalSales: { $sum: "$billDetail.grandTotal" },
          },
        },
      ]);
    } catch (error) {
      console.error("Error fetching total sales from Orders:", error);
      throw error;
    }
    const sales = totalSales[0]?.totalSales || 0;

    // Fetch merchants that opened today
    let merchants = [];
    try {
      merchants = await Merchant.find({ openedToday: true });
    } catch (error) {
      console.error("Error fetching merchants:", error);
      throw error;
    }

    let order = [];
    try {
      order = await Order.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfDay, $lte: endOfDay },
            status: { $ne: "Cancelled" }, // Exclude cancelled orders
          },
        },
      ]);
    } catch (err) {
      console.error(`Error saving order data`, err);
    }

    // Reset openedToday for each merchant
    for (const merchant of merchants) {
      merchant.openedToday = false;
      try {
        await merchant.save();
      } catch (error) {
        console.error(`Error saving merchant data for ${merchant._id}:`, error);
      }
    }

    // Fetch total commission from CommissionLogs
    let totalCommission = [];
    try {
      totalCommission = await CommissionLogs.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfDay, $lte: endOfDay },
          },
        },
        {
          $group: {
            _id: null,
            totalCommission: { $sum: "$payableAmountToFamto" },
          },
        },
      ]);
    } catch (error) {
      console.error("Error fetching total commission:", error);
      throw error;
    }
    const commission = totalCommission[0]?.totalCommission || 0;

    // Fetch total subscription amount from SubscriptionLog
    let totalSubscription = [];
    try {
      totalSubscription = await SubscriptionLog.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfDay, $lte: endOfDay },
            paymentStatus: "Paid", // Only consider paid subscriptions
          },
        },
        {
          $group: {
            _id: null,
            totalSubscription: { $sum: "$amount" },
          },
        },
      ]);
    } catch (error) {
      console.error("Error fetching total subscription amount:", error);
      throw error;
    }
    const subscription = totalSubscription[0]?.totalSubscription || 0;

    // Save the result to HomeScreenRevenueData
    try {
      const revenueData = new HomeScreenRevenueData({
        sales,
        merchants: merchants.length,
        order: order.length,
        commission,
        subscription,
      });
      await revenueData.save();
      return revenueData;
    } catch (error) {
      console.error("Error saving HomeScreenRevenueData:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error in fetchPerDayRevenue:", error);
    throw error;
  }
}

async function fetchMerchantDailyRevenue(date) {
  try {
    // Start and end of the day
    const previousDay = moment.tz(date, "Asia/Kolkata").subtract(1, "day");

    // Start and end of the previous day in IST
    const startOfDay = previousDay.startOf("day").toDate();
    const endOfDay = previousDay.endOf("day").toDate();

    // Fetch all merchants
    let merchants = [];
    try {
      merchants = await Merchant.find({});
    } catch (error) {
      console.error("Error fetching merchants:", error);
      throw error;
    }

    // Process each merchant's revenue
    for (const merchant of merchants) {
      // Fetch total sales for the merchant
      let totalSales = [];
      try {
        totalSales = await Order.aggregate([
          {
            $match: {
              createdAt: { $gte: startOfDay, $lte: endOfDay },
              merchantId: merchant._id,
              status: { $ne: "Cancelled" }, // Exclude cancelled orders
            },
          },
          {
            $group: {
              _id: null,
              totalSales: { $sum: "$billDetail.itemTotal" },
            },
          },
        ]);
      } catch (error) {
        console.error(
          `Error fetching total sales for merchant ${merchant._id}:`,
          error
        );
        continue; // Continue to next merchant if there's an error
      }
      const sales = totalSales[0]?.totalSales || 0;

      // Fetch total commission for the merchant
      let totalCommission = [];
      try {
        totalCommission = await CommissionLogs.aggregate([
          {
            $match: {
              createdAt: { $gte: startOfDay, $lte: endOfDay },
              merchantId: merchant._id,
            },
          },
          {
            $group: {
              _id: null,
              totalCommission: { $sum: "$payableAmountToFamto" },
            },
          },
        ]);
      } catch (error) {
        console.error(
          `Error fetching commission for merchant ${merchant._id}:`,
          error
        );
        continue;
      }
      const commission = totalCommission[0]?.totalCommission || 0;

      let order = [];
      try {
        order = await Order.aggregate([
          {
            $match: {
              createdAt: { $gte: startOfDay, $lte: endOfDay },
              merchantId: merchant._id,
              status: { $ne: "Cancelled" }, // Exclude cancelled orders
            },
          },
        ]);
      } catch (error) {
        console.error(
          `Error fetching total orders for merchant ${merchant._id}:`,
          error
        );
        continue; // Continue to next merchant if there's an error
      }

      // Save revenue data for each merchant
      try {
        const revenueData = new HomeScreenRevenueData({
          sales,
          commission,
          order: order.length,
          userId: merchant._id,
        });
        await revenueData.save();
      } catch (error) {
        console.error(
          `Error saving revenue data for merchant ${merchant._id}:`,
          error
        );
      }
    }
  } catch (error) {
    console.error("Error in fetchMerchantDailyRevenue:", error);
    throw error;
  }
}

module.exports = { fetchPerDayRevenue, fetchMerchantDailyRevenue };
