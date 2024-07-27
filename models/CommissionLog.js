const mongoose = require("mongoose");

const commissionLogsSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      ref: "Order",
      required: true,
    },
    merchantId: {
      type: String,
      ref: "Merchant",
      required: true,
    },
    merchantName: {
      type: String,
      required: true,
    },
    paymentMode: {
      type: String,
      enum: ["Famto-cash", "Online-payment", "Cash-on-delivery"],
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    payableAmountToMerchant: {
      type: Number,
      required: true,
    },
    payableAmountToFamto: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["Paid", "Unpaid"],
      default: "Unpaid",
    },
  },
  {
    timestamps: true,
  }
);

const CommissionLogs = mongoose.model("CommissionLogs", commissionLogsSchema);
module.exports = CommissionLogs;
