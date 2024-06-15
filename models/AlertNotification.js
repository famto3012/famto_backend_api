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
      required: true
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
      default: false
    },
    merchantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        default: null
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        default: null
    },
    agentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agent',
        default: null
    }
  },
  {
    timestamps: true,
  }
);

const AlertNotification = mongoose.model("AlertNotification", alertNotificationSchema);
module.exports = AlertNotification;
