const CommissionLogs = require("../models/CommissionLog");
const HomeScreenRevenueData = require("../models/HomeScreenRevenueData");
const Merchant = require("../models/Merchant");
const Order = require("../models/Order");
const SubscriptionLog = require("../models/SubscriptionLog");

async function fetchPerDayRevenue(date) {
  try {
    // Start and end of the day
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));
    console.log("start", startOfDay, "End", endOfDay)
    // Fetch total sales from Orders
    const totalSales = await Order.aggregate([
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
    const sales = totalSales[0]?.totalSales || 0;
    const merchants = await Merchant.find({openedToday: true});

    for(const merchant of merchants){
      merchant.openedToday = false;
      await merchant.save();
    }


    // Fetch total commission from CommissionLogs
    const totalCommission = await CommissionLogs.aggregate([
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

    const commission = totalCommission[0]?.totalCommission || 0;

    // Fetch total subscription amount from SubscriptionLog
    const totalSubscription = await SubscriptionLog.aggregate([
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

    const subscription = totalSubscription[0]?.totalSubscription || 0;

    // Save the result to HomeScreenRevenueData
    const revenueData = new HomeScreenRevenueData({
      sales,
      merchants: merchants.length,
      commission,
      subscription,
    });

    await revenueData.save();

    console.log("Revenue calculated")
    return revenueData;
  } catch (error) {
    console.error("Error fetching per day revenue:", error);
    throw error;
  }
}

async function fetchMerchantDailyRevenue(date) {
    try {
      // Start and end of the day
      const startOfDay = new Date(date.setHours(0, 0, 0, 0));
      const endOfDay = new Date(date.setHours(23, 59, 59, 999));
      console.log("start", startOfDay, "End", endOfDay)
      // Fetch merchants who opened today
      const merchants = await Merchant.find({});
  
      for (const merchant of merchants) {
        // Fetch total sales for the merchant
        const totalSales = await Order.aggregate([
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
  
        const sales = totalSales[0]?.totalSales || 0;
  
        // Fetch total commission for the merchant
        const totalCommission = await CommissionLogs.aggregate([
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
  
        const commission = totalCommission[0]?.totalCommission || 0;
  
        // Collect revenue data for each merchant
        const revenueData = new HomeScreenRevenueData({
            sales,
            commission,
            userId: merchant._id,
          });
    
          await revenueData.save();
  
        // Reset openedToday to false
        // merchant.openedToday = false;
        // await merchant.save();
        console.log("Merchant revenue data calculated:", revenueData);
      }
  
    //   return merchantRevenues;
    } catch (error) {
      console.error("Error fetching merchant daily revenue:", error);
      throw error;
    }
  }
  

module.exports = { fetchPerDayRevenue, fetchMerchantDailyRevenue };
