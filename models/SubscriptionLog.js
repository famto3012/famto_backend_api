const mongoose = require("mongoose");

const subscriptionLogSchema = new mongoose.Schema(
  {
    planId: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    typeOfUser: {
      type: String,
      enum: ["Customer", "Merchant"],
      default: null,
    },
    amount: {
      type: Number,
      required: true,
    },
    paymentMode: {
      type: String,
      enum: ["Online", "Cash"],
      default: null,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["Paid", "Unpaid", "Pending"],
      default: "Unpaid",
    },
    razorpayOrderId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const SubscriptionLog = mongoose.model(
  "SubscriptionLog",
  subscriptionLogSchema
);
module.exports = SubscriptionLog;
