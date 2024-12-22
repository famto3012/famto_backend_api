const mongoose = require("mongoose");
const Agent = require("./models/Agent");
const Merchant = require("./models/Merchant");
const MerchantSubscription = require("./models/MerchantSubscription");
const SubscriptionLog = require("./models/SubscriptionLog");

const applySubscriptionToAll = async () => {
  try {
    const allMerchants = await Merchant.find({ isBlocked: false });

    await SubscriptionLog.deleteMany({ typeOfUser: "Merchant" });

    for (const merchant of allMerchants) {
      merchant.merchantDetail.pricing = [];

      const subscriptionPlan = await MerchantSubscription.findOne({
        duration: 30,
      });

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + subscriptionPlan.duration);

      const newLog = await SubscriptionLog.create({
        planId: subscriptionPlan._id,
        userId: merchant._id,
        typeOfUser: "Merchant",
        amount: subscriptionPlan.amount,
        paymentMode: "Cash",
        startDate: startDate,
        endDate: endDate,
        paymentStatus: "Paid",
      });

      if (newLog) {
        const pricingData = {
          modelType: "Subscription",
          modelId: newLog._id,
        };

        merchant.merchantDetail.pricing.push(pricingData);
        await merchant.save();

        console.log(
          `Subscription created for ${merchant.merchantDetail.merchantName}`
        );
      }
    }
  } catch (err) {
    console.log(`Error in applying subscription to all: ${err}`);
  }
};

// applySubscriptionToAll();

const addTestAppDetail = async () => {
  try {
    const allAgents = await Agent.find({ isBlocked: false });

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    for (const agent of allAgents) {
      agent.appDetailHistory = [];

      for (let i = 0; i <= 5; i++) {
        const randomDate = new Date(yesterday.getTime());
        randomDate.setDate(Math.floor(Math.random() * yesterday.getDate()) + 1);

        const totalEarning = (Math.random() * (1000 - 100) + 100).toFixed(2);
        const totalDistance = (Math.random() * (110 - 50) + 50).toFixed(2);

        const loginDuration = Math.floor((totalDistance / 30) * 60 * 60 * 1000); // Assuming average speed of 30 km/h

        const orders = Math.floor(Math.random() * 20) + 1;
        const pendingOrders = Math.floor(Math.random() * 20) + 1;
        const cancelledOrders = Math.floor(Math.random() * 20) + 1;

        const data = {
          detailId: new mongoose.Types.ObjectId(),
          date: randomDate,
          details: {
            totalEarning: totalEarning,
            orders: orders,
            pendingOrders: pendingOrders,
            totalDistance: totalDistance,
            cancelledOrders: cancelledOrders,
            loginDuration: loginDuration,
            orderDetail: [],
            paymentSettled: false,
          },
        };

        agent.appDetailHistory.push(data);
      }

      await agent.save();

      console.log(`Data added for ${agent.fullName}`);
    }
  } catch (err) {
    console.error(`Error in creating test app detail: ${err}`);
  }
};

// addTestAppDetail();
