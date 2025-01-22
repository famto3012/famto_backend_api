const mongoose = require("mongoose");

const notificationSettingSchema = new mongoose.Schema(
  {
    event: {
      type: String,
      required: true,
      unique: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    admin: {
      type: Boolean,
      default: false,
    },
    merchant: {
      type: Boolean,
      default: false,
    },
    driver: {
      type: Boolean,
      default: false,
    },
    customer: {
      type: Boolean,
      default: false,
    },
    manager: {
      type: [String], // Array of strings
      default: [], // Default value is an empty array
    },
    whatsapp: {
      type: Boolean,
      default: false,
    },
    sms: {
      type: Boolean,
      default: false,
    },
    email: {
      type: Boolean,
      default: false,
    },
    status: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const NotificationSetting = mongoose.model(
  "NotificationSetting",
  notificationSettingSchema
);

module.exports = NotificationSetting;
