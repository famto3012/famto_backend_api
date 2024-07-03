const Customer = require("../../../models/Customer");
const CustomerSubscription = require("../../../models/CustomerSubscription");
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

    const merchant = await Merchant.findById(userId);

    let subscriptionPlan;
    if (merchant) {
      subscriptionPlan = await MerchantSubscription.findById(planId);
    } else {
      subscriptionPlan = await CustomerSubscription.findById(planId);
    }

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
      function addDays(date, days) {
        let result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
      }

      let startDate;

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

      const endDate = addDays(startDate, duration);
      console.log(endDate);

      const subscriptionLog = new SubscriptionLog({
        planId,
        userId,
        amount,
        paymentMode: "Cash",
        startDate,
        endDate,
        typeOfUser: "Merchant",
        paymentStatus: "Unpaid",
        razorpayOrderId: null,
      });

      await subscriptionLog.save();
    }

    if (paymentMode === "Online") {
      res.status(201).json({
        message: "Subscription order created successfully",
        amount,
        orderId: razorpayOrderId,
        currentPlan: planId,
        userId,
        paymentMode,
      });
    } else {
      res.status(201).json({
        message: "Subscription order created successfully",
        amount,
        currentPlan: planId,
        userId,
        paymentMode,
      });
    }
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

    const merchant = await Merchant.findById(userId);

    let subscriptionPlan;
    if (merchant) {
      subscriptionPlan = await MerchantSubscription.findById(currentPlan);
    } else {
      subscriptionPlan = await CustomerSubscription.findById(currentPlan);
    }

    if (!subscriptionPlan) {
      return res.status(404).json({ message: "Subscription plan not found" });
    }
    const customer = await Customer.findById(userId);

    let typeOfUser = "";

    if (!merchant) {
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
      console.log(customer);
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

const createSubscriptionLogUser = async (req, res, next) => {
  try {
    const { planId, paymentMode } = req.body;

    const userId = req.userAuth;
    console.log(userId);

    const merchant = await Merchant.findById(userId);

    let subscriptionPlan;
    if (merchant) {
      subscriptionPlan = await MerchantSubscription.findById(planId);
    } else {
      subscriptionPlan = await CustomerSubscription.findById(planId);
    }

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
      function addDays(date, days) {
        let result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
      }

      let startDate;

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

      const endDate = addDays(startDate, duration);
      console.log(endDate);

      const subscriptionLog = new SubscriptionLog({
        planId,
        userId,
        amount,
        paymentMode: "Cash",
        startDate,
        endDate,
        typeOfUser: "Merchant",
        paymentStatus: "Unpaid",
        razorpayOrderId: null,
      });

      await subscriptionLog.save();
    }

    if (paymentMode === "Online") {
      console.log(userId);
      res.status(201).json({
        message: "Subscription order created successfully",
        amount,
        orderId: razorpayOrderId,
        currentPlan: planId,
        userId,
        paymentMode,
      });
    } else {
      res.status(201).json({
        message: "Subscription order created successfully",
        amount,
        currentPlan: planId,
        userId,
        paymentMode,
      });
    }
  } catch (err) {
    next(appError(err.message));
  }
};

const setAsPaidController = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params;
    const subscriptionLog = await SubscriptionLog.findByIdAndUpdate(
      subscriptionId,
      { paymentStatus: "Paid" },
      { new: true }
    );
    if (!subscriptionLog) {
      return res.status(404).json({ message: "Subscription log not found" });
    }
    res.status(200).json({
      message: "Subscription log updated successfully",
      subscriptionLog,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAllMerchantSubscriptionLogController = async (req, res, next) => {
  try {
    const subscriptionLogs = await SubscriptionLog.find({
      typeOfUser: "Merchant",
    });
    res.status(200).json({
      message: "Subscription logs fetched successfully",
      subscriptionLogs,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAllCustomerSubscriptionLogController = async (req, res, next) => {
  try {
    const subscriptionLogs = await SubscriptionLog.find({
      typeOfUser: "Customer",
    });
    res.status(200).json({
      message: "Subscription logs fetched successfully",
      subscriptionLogs,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getByMerchantIdSubscriptionLogController = async (req, res, next) => {
  try {
    const { merchantId } = req.params;

    const subscriptionLogs = await SubscriptionLog.find({
      userId: merchantId,
    });
    res.status(200).json({
      message: "Subscription logs fetched successfully",
      subscriptionLogs,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getMerchantSubscriptionLogsByName = async (req, res, next) => {
  const { name } = req.query;

  try {
    // Find merchants whose names start with the given letter, case-insensitive
    const merchants = await Merchant.find({
      "merchantDetail.merchantName": new RegExp(`^${name}`, "i"),
    }).populate("merchantDetail.pricing");

    if (merchants.length === 0) {
      return res.status(404).json({ message: "No merchants found" });
    }

    // Extract subscription logs from all matching merchants
    const subscriptionLogsPromises = merchants.map((merchant) =>
      Promise.all(
        merchant.merchantDetail.pricing.map(async (pricingId) => {
          return await SubscriptionLog.findById(pricingId);
        })
      )
    );

    const subscriptionLogs = await Promise.all(subscriptionLogsPromises);

    res.status(200).json(subscriptionLogs.flat());
  } catch (err) {
    next(appError(err.message));
  }
};

const getMerchantSubscriptionLogsByStartDate = async (req, res, next) => {
  const { startDate } = req.query;

  try {
    // Validate startDate
    if (!startDate) {
      return res.status(400).json({ message: 'Start date is required' });
    }

    // Find subscription logs by start date
    const subscriptionLogs = await SubscriptionLog.find({
      startDate: new Date(startDate),
    });

    if (subscriptionLogs.length === 0) {
      return res.status(404).json({ message: 'No subscription logs found for the provided start date' });
    }

    res.status(200).json(subscriptionLogs);
  } catch (err) {
    next(appError(err.message));
  }
};

const getCustomerSubscriptionLogsByName = async (req, res, next) => {
  const { name } = req.query;

  try {
    // Find merchants whose names start with the given letter, case-insensitive
    const customers = await Customer.find({
      fullName: new RegExp(`^${name}`, "i"),
    }).populate("customerDetails.pricing")

    if (customers.length === 0) {
      return res.status(404).json({ message: "No customers found" });
    }

    const subscriptionLogsPromises = customers.map((customer) =>
      Promise.all(
        customer.customerDetails.pricing.map(async (pricingId) => {
          return await SubscriptionLog.findById(pricingId);
        })
      )
    );

    const subscriptionLogs = await Promise.all(subscriptionLogsPromises);

    res.status(200).json(subscriptionLogs.flat());
  } catch (err) {
    next(appError(err.message));
  }
};


module.exports = {
  createSubscriptionLog,
  verifyRazorpayPayment,
  createSubscriptionLogUser,
  setAsPaidController,
  getAllMerchantSubscriptionLogController,
  getAllCustomerSubscriptionLogController,
  getByMerchantIdSubscriptionLogController,
  getMerchantSubscriptionLogsByName,
  getMerchantSubscriptionLogsByStartDate,
  getCustomerSubscriptionLogsByName,
};
