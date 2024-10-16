const Merchant = require("../models/Merchant");
const MerchantNotificationLogs = require("../models/MerchantNotificationLog");
const { sendNotification } = require("../socket/socket");

const deleteExpiredSponsorshipPlans = async () => {
  const now = new Date();
  const today = new Date(now.setHours(0, 0, 0, 0)); // Current date set to midnight
  const threeDaysFromNow = new Date(today);
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  const user = "Merchant";

  try {
    // Find all merchants with sponsorship plans expiring within the next 3 days
    const merchants = await Merchant.find({
      "sponsorshipDetail.endDate": { $lte: threeDaysFromNow },
    });

    for (const merchant of merchants) {
      for (const sponsorship of merchant.sponsorshipDetail) {
        const daysUntilExpiration = Math.ceil(
          (sponsorship.endDate - now) / (1000 * 60 * 60 * 24)
        );

        const description = `Your sponsorship plan will expire in ${daysUntilExpiration} days. Renew now to avoid disconnection.`;

        // Check if a notification has already been sent today
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));
        const endOfDay = new Date(now.setHours(23, 59, 59, 999));

        const notificationExists = await MerchantNotificationLogs.findOne({
          merchantId: merchant._id,
          description,
          createdAt: { $gte: startOfDay, $lt: endOfDay },
        });

        if (
          !notificationExists &&
          now >= sponsorship.endDate - 3 * 24 * 60 * 60 * 1000 && // 3 days before expiration
          now < sponsorship.endDate
        ) {
          // Send notification about plan expiration
          const data = {
            socket: {
              title: "Sponsorship Plan Expiration",
              description,
            },
            fcm: {
              title: "Sponsorship Plan Expiration",
              body: description,
              image: "",
              merchantId: merchant._id,
            },
          };

          const eventName = "sponsorshipPlanEnd";
          sendNotification(merchant._id, eventName, data, user);
          sendNotification(process.env.ADMIN_ID, eventName, data, user);
        }

        // Remove expired plans
        if (now >= sponsorship.endDate) {
          await Merchant.updateOne(
            { _id: merchant._id },
            {
              $pull: {
                sponsorshipDetail: { _id: sponsorship._id },
              },
            }
          );

          const data = {
            socket: {
              title: "Sponsorship Plan Expired",
              description: "Your sponsorship plan has expired.",
            },
            fcm: {
              title: "Sponsorship Plan Expired",
              body: "Your sponsorship plan has expired.",
              image: "",
              merchantId: merchant._id,
            },
          };

          const eventName = "sponsorshipPlanExpired";
          sendNotification(merchant._id, eventName, data, user);
          sendNotification(process.env.ADMIN_ID, eventName, data, user);
        }
      }
    }

    console.log("Expired sponsorship plans processed successfully");
  } catch (err) {
    console.error(`Error deleting expired sponsorship plans: ${err}`);
  }
};

const calculateEndDate = (startDate, plan) => {
  const date = new Date(startDate);
  switch (plan) {
    case "Monthly":
      date.setDate(date.getDate() + 30);
      break;
    case "3 Month":
      date.setDate(date.getDate() + 90);
      break;
    case "6 Month":
      date.setDate(date.getDate() + 180);
      break;
    case "1 Year":
      date.setDate(date.getDate() + 365);
      break;
    default:
      throw new Error("Invalid plan");
  }
  return date;
};

const getPlanAmount = (plan) => {
  switch (plan) {
    case "Monthly":
      return 299;
    case "3 Month":
      return 799;
    case "6 Month":
      return 1399;
    case "1 Year":
      return 2999;
    default:
      throw new Error("Invalid plan");
  }
};

module.exports = {
  deleteExpiredSponsorshipPlans,
  calculateEndDate,
  getPlanAmount,
};
