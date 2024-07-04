const Commission = require("../models/Commission");
const CommissionLogs = require("../models/CommissionLog");
const Merchant = require("../models/Merchant");
const Order = require("../models/Order");
const appError = require("./appError");

const orderCommissionLogHelper = async (orderId) => {
  try {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error("Order not found");
    }
    console.log("Order:", order);

    const merchant = await Merchant.findById(order.merchantId);
    if (!merchant) {
      throw new Error("Merchant not found");
    }
    console.log("Merchant:", merchant);

    const merchantName = merchant.merchantDetail.merchantName;

    const commissions = await Commission.find({ merchantId: order.merchantId });
    if (commissions.length === 0) {
      throw new Error("No commission found for the merchant");
    }
    const commission = commissions[0];
    console.log("Commission:", commission);

    const totalAmount = order.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    console.log("Total Amount:", totalAmount);

    let payableAmountToMerchant = 0;
    let payableAmountToFamto = 0;
    if (commission.commissionType === "Percentage") {
      payableAmountToFamto = (totalAmount * commission.commissionValue) / 100;
      payableAmountToMerchant = totalAmount - payableAmountToFamto;
    } else {
      payableAmountToFamto = commission.commissionValue;
      payableAmountToMerchant = totalAmount - payableAmountToFamto;
    }

    console.log("Payable Amount to Famto:", payableAmountToFamto);
    console.log("Payable Amount to Merchant:", payableAmountToMerchant);

    const commissionLog = new CommissionLogs({
      orderId,
      merchantId: order.merchantId,
      merchantName,
      totalAmount,
      payableAmountToMerchant,
      payableAmountToFamto,
      paymentMode: order.paymentMode,
      status: "Unpaid",
    });

    const saved = await commissionLog.save();
    console.log("Commission Log Saved:", saved);
  } catch (err) {
    appError(err.message);
  }
};

module.exports = { orderCommissionLogHelper };
