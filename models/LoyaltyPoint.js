const mongoose = require("mongoose");

const loyaltyPointSchema = mongoose.Schema(
  {
    status: {
      type: Boolean,
      default: true,
    },
    earningCriteriaRupee: {
      type: Number,
      required: true,
    },
    earningCriteriaPoint: {
      type: Number,
      required: true,
    },
    minOrderAmountForEarning: {
      type: Number,
      required: true,
    },
    maxEarningPointPerOrder: {
      type: Number,
      required: true,
    },
    expiryDuration: {
      type: Number,
      required: true,
    },
    redemptionCriteriaPoint: {
      type: Number,
      required: true,
    },
    redemptionCriteriaRupee: {
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
    maxRedemptionAmountPercentage: {
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
