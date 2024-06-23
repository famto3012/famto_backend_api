const Merchant = require("../models/Merchant");

const deleteExpiredSponsorshipPlans = async () => {
  const now = new Date();

  try {
    // Find all merchants with expired sponsorship plans
    const merchants = await Merchant.find({
      "sponsorshipDetail.endDate": { $lte: now },
    });

    merchants.forEach(async (merchant) => {
      // Filter out expired plans
      const activePlans = merchant.sponsorshipDetail.filter(
        (plan) => new Date(plan.endDate) > now
      );

      // Update merchant with only active plans
      merchant.sponsorshipDetail = activePlans;
      await merchant.save();
    });

    console.log("Expired sponsorship plans deleted successfully");
  } catch (err) {
    console.error("Error deleting expired sponsorship plans:", err);
  }
};

const calculateEndDate = (startDate, plan) => {
  const date = new Date(startDate);
  switch (plan) {
    case "Monthly":
      date.setMonth(date.getMonth() + 1);
      break;
    case "3 Month":
      date.setMonth(date.getMonth() + 3);
      break;
    case "6 Month":
      date.setMonth(date.getMonth() + 6);
      break;
    case "1 Year":
      date.setFullYear(date.getFullYear() + 1);
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
