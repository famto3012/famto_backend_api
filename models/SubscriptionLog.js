const mongoose = require("mongoose");

const subscriptionLogSchema = new mongoose.Schema(
  {
    planId: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
    typeOfUser: {
      type: String,
      enum: ["Customer", "Merchant"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    maxOrders: {
      type: Number,
      default: null,
    },
    currentNumberOfOrders: {
      type: Number,
      default: 0,
    },
    paymentMode: {
      type: String,
      enum: ["Online", "Cash"],
      required: true,
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
