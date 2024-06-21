const mongoose = require("mongoose");

const agentPricingSchema = new mongoose.Schema(
  {
    ruleName: {
      type: String,
      required: true,
    },
    baseFare: {
      type: Number,
      required: true,
    },
    baseDistanceFare: {
      type: Number,
      required: true,
    },
    extraFarePerDay: {
      type: Number,
      required: true,
    },
    baseDistanceFarePerKM: {
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
    purchaseFarePerHour: {
      type: Number,
      required: true,
    },
    addedTip: {
      type: Number,
      required: true,
    },
    geofenceId: {
      type: mongoose.Types.ObjectId,
      ref: "Geofence",
      required: true,
    },
    status: {
      type: Boolean,
      default: true,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const AgentPricing = mongoose.model("AgentPricing", agentPricingSchema);
module.exports = AgentPricing;
