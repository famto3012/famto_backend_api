const Merchant = require("../models/Merchant");

const deleteExpiredSponsorshipPlans = async () => {
  const now = new Date();

  try {
    // Find all merchants with expired sponsorship plans
    const merchants = await Merchant.find({
      "sponsorshipDetail.endDate": { $lte: now },
    });

    // Use for...of loop to handle asynchronous operations correctly
    for (const merchant of merchants) {
      // Remove expired plans
      await Merchant.updateOne(
        { _id: merchant._id },
        {
          $pull: {
            sponsorshipDetail: { endDate: { $lte: now } },
          },
        }
      );
    }

    console.log("Expired sponsorship plans deleted successfully");
  } catch (err) {
    console.error("Error deleting expired sponsorship plans:", err);
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
      return 250;
    case "3 Month":
      return 750;
    case "6 Month":
      return 1500;
    case "1 Year":
      return 3000;
    default:
      throw new Error("Invalid plan");
  }
};

module.exports = {
  deleteExpiredSponsorshipPlans,
  calculateEndDate,
  getPlanAmount,
};
