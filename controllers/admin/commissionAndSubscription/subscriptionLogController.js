const Customer = require("../../../models/Customer");
const Merchant = require("../../../models/Merchant");
const MerchantSubscription = require("../../../models/MerchantSubscription");
const SubscriptionLog = require("../../../models/SubscriptionLog");
const appError = require("../../../utils/appError");
const {
  createRazorpayOrderId,
  verifyPayment,
} = require("../../../utils/razorpayPayment");

const createSubscriptionLog = async (req, res, next) => {
  try {
    const { planId, userId, paymentMode } = req.body;

    const subscriptionPlan = await MerchantSubscription.findById(planId);

    if (!subscriptionPlan) {
      return res.status(404).json({ message: "Subscription plan not found" });
    }

    const { amount, duration } = subscriptionPlan;

    if (paymentMode === "Online") {
      const razorpayOrderResponse = await createRazorpayOrderId(amount);
      if (!razorpayOrderResponse.success) {
        return res.status(500).json({
          message: "Failed to create Razorpay order",
          error: razorpayOrderResponse.error,
        });
      }
      razorpayOrderId = razorpayOrderResponse.orderId;
      paymentStatus = "Pending";
    } else {
      
    }

    res.status(201).json({
      message: "Subscription order created successfully",
      amount,
      orderId: razorpayOrderId,
      currentPlan: planId,
      userId,
      paymentMode,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const verifyRazorpayPayment = async (req, res, next) => {
  const paymentDetails = req.body;

  try {
    const isValidPayment = verifyPayment(paymentDetails);
    const {
      razorpay_order_id,
      razorpay_payment_id,
      currentPlan,
      userId,
      paymentMode,
    } = paymentDetails;
    if (!isValidPayment) {
      return res.status(400).json({ message: "Invalid payment details" });
    }

    const subscriptionPlan = await MerchantSubscription.findById(currentPlan);

    if (!subscriptionPlan) {
      return res.status(404).json({ message: "Subscription plan not found" });
    }
    const merchant = await Merchant.findById(userId);
    const customer = await Customer.findById(userId);

    let typeOfUser = "";

    if (merchant.length === 0) {
      typeOfUser = "Customer";
    } else {
      typeOfUser = "Merchant";
    }

    const { amount, duration } = subscriptionPlan;

    function addDays(date, days) {
      let result = new Date(date);
      result.setDate(result.getDate() + days);
      return result;
    }

    let startDate;

    if (typeOfUser === "Merchant") {
      if (merchant.merchantDetail.pricing.length === 0) {
        startDate = new Date();
      } else {
        let sub = await SubscriptionLog.findById(
          merchant.merchantDetail.pricing[
            merchant.merchantDetail.pricing.length - 1
          ]
        );
        console.log(sub);
        startDate = sub.endDate;
      }
    } else {
      if (customer.customerDetails.pricing.length === 0) {
        startDate = new Date();
      } else {
        let sub = await SubscriptionLog.findById(
          customer.customerDetails.pricing[
            customer.customerDetails.pricing.length - 1
          ]
        );
        startDate = sub.endDate;
      }
    }

    const endDate = addDays(startDate, duration);
    console.log(endDate);

    const subscriptionLog = new SubscriptionLog({
      planId: currentPlan,
      userId,
      amount,
      paymentMode,
      startDate,
      endDate,
      typeOfUser,
      paymentStatus: "Paid",
      razorpayOrderId: razorpay_order_id,
    });

    await subscriptionLog.save();

    if (typeOfUser === "Merchant") {
      const merchantFound = await Merchant.findById(userId);
      merchantFound.merchantDetail.pricing.push(subscriptionLog._id);
      await merchantFound.save();
    } else {
      const customerFound = await Customer.findById(userId);
      customerFound.customerDetails.pricing.push(subscriptionLog._id);
      await customerFound.save();
    }

    res.status(200).json({
      message: "Payment verified and subscription log updated successfully",
      subscriptionLog,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = { createSubscriptionLog, verifyRazorpayPayment };
