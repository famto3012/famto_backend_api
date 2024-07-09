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

    const merchant = await Merchant.findById(order.merchantId);
    if (!merchant) {
      throw new Error("Merchant not found");
    }

    const merchantName = merchant.merchantDetail.merchantName;

    const commissions = await Commission.find({ merchantId: order.merchantId });
    if (commissions.length === 0) {
      throw new Error("No commission found for the merchant");
    }
    const commission = commissions[0];

    const totalAmount = order.billDetail.itemTotal;

    let payableAmountToMerchant = 0;
    let payableAmountToFamto = 0;
    if (commission.commissionType === "Percentage") {
      payableAmountToFamto = (totalAmount * commission.commissionValue) / 100;
      payableAmountToMerchant = totalAmount - payableAmountToFamto;
    } else {
      payableAmountToFamto = commission.commissionValue;
      payableAmountToMerchant = totalAmount - payableAmountToFamto;
    }

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

    await commissionLog.save();

    return { payableAmountToFamto, payableAmountToMerchant };
  } catch (err) {
    appError(err.message);
  }
};

module.exports = { orderCommissionLogHelper };
