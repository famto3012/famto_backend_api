const Customer = require("../models/Customer");
const CustomerNotificationLogs = require("../models/CustomerNotificationLog");
const Merchant = require("../models/Merchant");
const MerchantNotificationLogs = require("../models/MerchantNotificationLog");
const SubscriptionLog = require("../models/SubscriptionLog");
const { sendNotification } = require("../socket/socket");

const deleteExpiredSubscriptionPlans = async () => {
  const now = new Date();
  const today = new Date(now.setHours(0, 0, 0, 0));
  const threeDaysFromNow = new Date(today);
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  try {
    // Fetch logs where the endDate is within the next 3 days or has already passed
    const subscriptionLogs = await SubscriptionLog.find({
      endDate: { $lte: threeDaysFromNow },
    });

    for (const subscriptionLog of subscriptionLogs) {
      // Calculate the date that is 3 days before the endDate
      const threeDaysBeforeEndDate = new Date(subscriptionLog.endDate);
      threeDaysBeforeEndDate.setDate(threeDaysBeforeEndDate.getDate() - 3);

      const daysUntilExpiration = Math.ceil(
        (subscriptionLog.endDate - now) / (1000 * 60 * 60 * 24)
      );
      const description = `Your plan will expire in ${daysUntilExpiration} days. Recharge now to avoid disconnection.`;

      // Check if a notification has already been sent today for this merchant/customer
      let notificationExists = false;

      const startOfDay = new Date(now.setHours(0, 0, 0, 0));
      const endOfDay = new Date(now.setHours(23, 59, 59, 999));
      // Check if today is 3 days before the endDate or later

      if (subscriptionLog.typeOfUser === "Merchant") {
        notificationExists = await MerchantNotificationLogs.findOne({
          merchantId: subscriptionLog.userId,
          description,
          createdAt: { $gte: startOfDay, $lt: endOfDay },
        });
      } else {
        notificationExists = await CustomerNotificationLogs.findOne({
          customerId: subscriptionLog.userId,
          description,
          createdAt: { $gte: startOfDay, $lt: endOfDay },
        });
      }

      if (
        now >= threeDaysBeforeEndDate &&
        now < subscriptionLog.endDate &&
        !notificationExists
      ) {
        console.log(
          `Subscription plan for ${subscriptionLog.typeOfUser} with ID ${subscriptionLog.userId} will expire in ${daysUntilExpiration} days.`
        );

        const data = {
          socket: {
            title: `Subscription plan`,
            description,
          },
          fcm: {
            title: `Subscription plan`,
            body: description,
            image: "",
            ...(subscriptionLog.typeOfUser === "Customer"
              ? { customerId: subscriptionLog.userId }
              : { merchantId: subscriptionLog.userId }),
          },
        };

        const eventName = "subscriptionPlanEnd";
        sendNotification(
          subscriptionLog.userId,
          eventName,
          data,
          subscriptionLog.typeOfUser
        );

        // Proceed with deletion if the plan has expired
        if (now >= subscriptionLog.endDate) {
          if (subscriptionLog.typeOfUser === "Merchant") {
            // Remove the subscription log ID from the pricing array
            await Merchant.updateOne(
              { "merchantDetail.pricing": subscriptionLog._id },
              { $pull: { "merchantDetail.pricing": subscriptionLog._id } }
            );
            const data = {
              socket: {
                title: `Subscription plan`,
                description: `Your plan has expired.`,
              },
              fcm: {
                title: `Subscription plan`,
                body: `Your plan has expired.`,
                image: "",
                merchantId: subscriptionLog.userId,
              },
            };
            const eventName = "subscriptionPlanEnd";
            sendNotification(
              subscriptionLog.userId,
              eventName,
              data,
              subscriptionLog.typeOfUser
            );
          } else {
            // Fetch customer with this subscription log ID in their pricing array
            await Customer.updateOne(
              { "customerDetails.pricing": subscriptionLog._id },
              { $pull: { "customerDetails.pricing": subscriptionLog._id } }
            );

            const data = {
              socket: {
                title: `Subscription plan`,
                description: `Your plan has expired.`,
              },
              fcm: {
                title: `Subscription plan`,
                body: `Your plan has expired.`,
                image: "",
                customerId: subscriptionLog.userId,
              },
            };
            const eventName = "subscriptionPlanEnd";
            sendNotification(
              subscriptionLog.userId,
              eventName,
              data,
              subscriptionLog.typeOfUser
            );
          }

          // Remove expired subscription log
          await SubscriptionLog.deleteOne({ _id: subscriptionLog.id });

          // Log when the plan is removed
          console.log(
            `Subscription plan for ${subscriptionLog.typeOfUser} with ID ${subscriptionLog.userId} has been removed.`
          );
        }
      }
    }

    console.log("Expired subscription plans processed successfully");
  } catch (err) {
    console.error("Error processing expired subscription plans:", err);
  }
};

module.exports = { deleteExpiredSubscriptionPlans };
