const mongoose = require("mongoose");

const merchantSubscriptionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: "subscription",
    },
    name: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    duration: {
      type: Number,
      required: true,
    },
    taxId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tax",
    },
    renewalReminder: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const MerchantSubscription = mongoose.model(
  "MerchantSubscription",
  merchantSubscriptionSchema
);
module.exports = MerchantSubscription;
