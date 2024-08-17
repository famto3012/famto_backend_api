const mongoose = require("mongoose");

const MerchantNotificationLogSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      ref: "Order",
      default: null,
    },
    merchantId: {
      type: String,
      ref: "Merchant",
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

const MerchantNotificationLogs = mongoose.model(
  "MerchantNotificationLogs",
  MerchantNotificationLogSchema
);

module.exports = MerchantNotificationLogs;
