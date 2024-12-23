const mongoose = require("mongoose");

const customerSubscriptionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: "Subscription",
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
      default: null,
    },
    renewalReminder: {
      type: Number,
      required: true,
    },
    noOfOrder: {
      type: Number,
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

const CustomerSubscription = mongoose.model(
  "CustomerSubscription",
  customerSubscriptionSchema
);
module.exports = CustomerSubscription;
