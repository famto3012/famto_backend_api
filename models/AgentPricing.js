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
    baseDistanceFarePerKM: {
      type: Number,
      required: true,
    },
    waitingFare: {
      type: Number,
      default: null,
    },
    waitingTime: {
      type: Number,
      default: null,
    },
    purchaseFarePerHour: {
      type: Number,
      default: null,
    },
    minLoginHours: {
      type: Number,
      required: true,
    },
    minOrderNumber: {
      type: Number,
      required: true,
    },
    fareAfterMinLoginHours: {
      type: Number,
      default: null,
    },
    fareAfterMinOrderNumber: {
      type: Number,
      default: null,
    },
    status: {
      type: Boolean,
      default: true,
    },
    geofenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Geofence",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const AgentPricing = mongoose.model("AgentPricing", agentPricingSchema);
module.exports = AgentPricing;
