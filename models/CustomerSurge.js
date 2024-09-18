const mongoose = require("mongoose");

const customerSurgeSchema = new mongoose.Schema(
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
      default: null,
    },
    waitingTime: {
      type: Number,
      default: null,
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

const CustomerSurge = mongoose.model("CustomerSurge", customerSurgeSchema);
module.exports = CustomerSurge;
