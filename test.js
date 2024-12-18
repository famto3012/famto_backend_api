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

applySubscriptionToAll();
