const mongoose = require("mongoose");

const alertNotificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    merchant: {
      type: Boolean,
      default: false,
    },
    agent: {
      type: Boolean,
      default: false,
    },
    customer: {
      type: Boolean,
      default: false,
    },
    merchantId: {
      type: String,
      ref: "Merchant",
      default: null,
    },
    customerId: {
      type: String,
      ref: "Customer",
      default: null,
    },
    agentId: {
      type: String,
      ref: "Agent",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const AlertNotification = mongoose.model(
  "AlertNotification",
  alertNotificationSchema
);
module.exports = AlertNotification;
