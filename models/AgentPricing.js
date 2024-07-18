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
      default: null,
    },
    extraFarePerDay: {
      type: Number,
      default: null,
    },
    baseDistanceFarePerKM: {
      type: Number,
      default: null,
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
    geofenceId: {
      type: mongoose.Schema.Types.ObjectId,
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

const AgentPricing = mongoose.model("AgentPricing", agentPricingSchema);
module.exports = AgentPricing;
