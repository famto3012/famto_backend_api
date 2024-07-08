const Customer = require("../models/Customer");
const Merchant = require("../models/Merchant");
const SubscriptionLog = require("../models/SubscriptionLog");

const deleteExpiredSubscriptionPlans = async () => {
  const now = new Date();

  try {
    const subscriptionLogs = await SubscriptionLog.find({
      endDate: { $lte: now },
    });

    for (const subscriptionLog of subscriptionLogs) {
      if (subscriptionLog.typeOfUser === "Merchant") {
        // Remove the subscription log ID from the pricing array
        await Merchant.updateOne(
          { "merchantDetail.pricing": subscriptionLog._id },
          { $pull: { "merchantDetail.pricing": subscriptionLog._id } }
        );
      } else {
        // Fetch customer with this subscription log ID in their pricing array
        await Customer.updateOne(
          { "customerDetails.pricing": subscriptionLog._id },
          { $pull: { "customerDetails.pricing": subscriptionLog._id } }
        );
      }

      // Remove expired subscription log
      await SubscriptionLog.deleteOne({ _id: subscriptionLog.id });
    }

    console.log("Expired subscription plans deleted successfully");
  } catch (err) {
    console.error("Error deleting expired subscription plans:", err);
  }
};

module.exports = { deleteExpiredSubscriptionPlans };
