const mongoose = require("mongoose");

const pushNotificationSchema = new mongoose.Schema(
  {
    event: {
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
      default: false
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
  },
  {
    timestamps: true,
  }
);

const PushNotification = mongoose.model("PushNotification", pushNotificationSchema);
module.exports = PushNotification;
