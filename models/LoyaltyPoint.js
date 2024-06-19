const mongoose = require("mongoose");

const loyaltyPointSchema = mongoose.Schema(
  {
    status: {
      type: Boolean,
      default: true,
    },
    earningCriteraRupee: {
      type: Number,
      required: true,
    },
    earningCriteraPoint: {
      type: Number,
      required: true,
    },
    minOrderAmountForEarning: {
      type: Number,
      required: true,
    },
    maxEarningPoint: {
      type: Number,
      required: true,
    },
    expiryDuration: {
      type: Number,
      required: true,
    },
    redemptionCriteraPoint: {
      type: Number,
      required: true,
    },
    redemptionCriteraRupee: {
      type: Number,
      required: true,
    },
    minOrderAmountForRedemption: {
      type: Number,
      required: true,
    },
    minLoyaltyPointForRedemption: {
      type: Number,
      required: true,
    },
    minRedemptionAmountPercentage: {
      type: Number,
      required: true,
    },
  },
  {
    timestamp: true,
  }
);

const LoyaltyPoint = mongoose.model("LoyaltyPoint", loyaltyPointSchema);
module.exports = LoyaltyPoint;
