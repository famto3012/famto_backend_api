const mongoose = require("mongoose");

const agentSurgeSchema = new mongoose.Schema(
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

const AgentSurge = mongoose.model("AgentSurge", agentSurgeSchema);
module.exports = AgentSurge;
