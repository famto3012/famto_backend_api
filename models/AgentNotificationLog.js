const mongoose = require("mongoose");

// Define a sub-schema for the details
const DetailSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  address: {
    fullName: String,
    phoneNumber: String,
    flat: String,
    area: String,
    landmark: { type: String, default: null },
  },
});

const AgentNotificationLogSchema = new mongoose.Schema(
  {
    agentId: {
      type: String,
      ref: "Agent",
      required: true,
    },
    orderId: {
      type: String,
      ref: "Order",
      required: true,
    },
    pickupDetail: {
      type: DetailSchema,
      required: true,
    },
    deliveryDetail: {
      type: DetailSchema,
      required: true,
    },
    orderType: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["Accepted", "Rejected"],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const AgentNotificationLogs = mongoose.model(
  "AgentNotificationLogs",
  AgentNotificationLogSchema
);

module.exports = AgentNotificationLogs;
