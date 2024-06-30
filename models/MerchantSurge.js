const mongoose = require("mongoose");

const merchantSurgeSchema = new mongoose.Schema(
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
    waitingFare: {
      type: Number,
      required: true,
    },
    waitingTime: {
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
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const MerchantSurge = mongoose.model("MerchantSurge", merchantSurgeSchema);
module.exports = MerchantSurge;
