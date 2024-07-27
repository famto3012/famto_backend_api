const mongoose = require("mongoose");

const AgentAnnouncementLogSchema = new mongoose.Schema(
  {
    agentId: {
      type: String,
      ref: "Agent",
      required: true,
    },
    imageUrl: {
      type: String,
      default: null,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const AgentAnnouncementLogs = mongoose.model(
  "AgentAnnouncementLogs",
  AgentAnnouncementLogSchema
);

module.exports = AgentAnnouncementLogs;
