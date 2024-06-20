const mongoose = require("mongoose");

const merchantPricingSchema = new mongoose.Schema(
  {
    ruleName: {
      type: String,
      required: true,
    },
    baseFare: {
      type: Number,
      required: true,
    },
    baseDistance: {
      type: Number,
      required: true,
    },
    fareAfterBaseDistance: {
      type: Number,
      required: true,
    },
    baseWeightUpTo: {
      type: Number,
      required: true,
    },
    fareAfterBaseWeight: {
      type: Number,
      required: true,
    },
    purchaseFarePerHour: {
      type: Number,
      required: true,
    },
    waitingFare: {
      type: Number,
      required: true,
    },
    waitingTime: {
      type: Number,
      required: true,
    },
    geofenceId: {
      type: mongoose.Schema.ObjectId,
      ref: "Geofence",
      required: true,
    },
    status: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const MerchantPricing = mongoose.model(
  "MerchantPricing",
  merchantPricingSchema
);
module.exports = MerchantPricing;
