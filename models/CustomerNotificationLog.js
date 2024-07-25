const mongoose = require("mongoose");

const CustomerNotificationLogSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
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

const CustomerNotificationLogs = mongoose.model(
  "CustomerNotificationLogs",
  CustomerNotificationLogSchema
);

module.exports = CustomerNotificationLogs;
