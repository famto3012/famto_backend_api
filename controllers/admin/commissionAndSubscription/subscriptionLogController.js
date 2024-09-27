const moment = require("moment");

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

    let responseOrderId;
    if (paymentMode === "Online") {
      const { orderId, success, error } = await createRazorpayOrderId(amount);

      if (!success) {
        return res.status(500).json({
          message: "Failed to create Razorpay order",
          error: error,
        });
      }

      responseOrderId = orderId;
    } else {
      function addDays(date, days) {
        let result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
      }

      let startDate;

      if (merchant?.merchantDetail?.pricing?.length === 0) {
        startDate = new Date();
      } else {
        let sub = await SubscriptionLog.findById(
          merchant.merchantDetail.pricing[
            merchant.merchantDetail.pricing.length - 1
          ]
        );

        startDate = sub.endDate;
      }

      const endDate = addDays(startDate, duration);

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
        orderId: responseOrderId,
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

    const subscriptionLog = new SubscriptionLog({
      planId: currentPlan,
      userId,
      amount,
      paymentMode,
      startDate,
      endDate,
      typeOfUser,
      maxOrders: subscriptionPlan?.maxOrders,
      paymentStatus: "Paid",
      razorpayOrderId: razorpay_order_id,
    });

    await subscriptionLog.save();

    let transactionDetail = {
      transactionAmount: amount,
      transactionType: "Subscription",
      madeOn: new Date(),
      type: "Debit",
    };

    if (typeOfUser === "Merchant") {
      const merchantFound = await Merchant.findById(userId);
      merchantFound.merchantDetail.pricing.push({
        modelType: "Subscription",
        modelId: subscriptionLog._id,
      });
      await merchantFound.save();
    } else {
      const customerFound = await Customer.findById(userId);

      customerFound.customerDetails.pricing.push(subscriptionLog._id);
      customerFound.transactionDetail.push(transactionDetail);

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

        startDate = sub.endDate;
      }

      const endDate = addDays(startDate, duration);

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

const setAsPaidController = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params;
    const subscriptionLog = await SubscriptionLog.findByIdAndUpdate(
      subscriptionId,
      { paymentStatus: "Paid" },
      { new: true }
    );
    const typeOfUser = subscriptionLog.typeOfUser;
    if (typeOfUser === "Merchant") {
      const merchantFound = await Merchant.findById(subscriptionLog.userId);
      merchantFound.merchantDetail.pricing.push({
        modelType: "Subscription",
        modelId: subscriptionLog._id,
      });
      await merchantFound.save();
    }
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
    // Step 1: Fetch all subscription logs for Merchants
    const subscriptionLogs = await SubscriptionLog.find({
      typeOfUser: "Merchant",
    });

    // Step 2: Extract unique userIds from the subscription logs
    const userIds = [...new Set(subscriptionLogs.map((log) => log.userId))];

    // Step 3: Fetch user details for the extracted userIds
    const users = await Merchant.find({ _id: { $in: userIds } });

    // Step 4: Create a map of userId to user details for quick lookup
    const userMap = users.reduce((map, user) => {
      map[user._id] = user.merchantDetail.merchantName;
      return map;
    }, {});

    // Step 5: Combine subscription logs with the corresponding user details
    const combinedData = subscriptionLogs.map((log) => ({
      ...log.toObject(),
      user: userMap[log.userId],
    }));

    // Send the combined data as the response
    res.status(200).json({
      message: "Subscription logs fetched successfully",
      subscriptionLogs: combinedData,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAllCustomerSubscriptionLogController = async (req, res, next) => {
  try {
    // Step 1: Fetch all subscription logs for Merchants
    const subscriptionLogs = await SubscriptionLog.find({
      typeOfUser: "Customer",
    });

    // Step 2: Extract unique userIds from the subscription logs
    const userIds = [...new Set(subscriptionLogs.map((log) => log.userId))];

    // Step 3: Fetch user details for the extracted userIds
    const users = await Customer.find({ _id: { $in: userIds } });

    // Step 4: Create a map of userId to user details for quick lookup
    const userMap = users.reduce((map, user) => {
      map[user._id] = user.fullName;
      return map;
    }, {});

    // Step 5: Combine subscription logs with the corresponding user details
    const combinedData = subscriptionLogs.map((log) => ({
      ...log.toObject(),
      user: userMap[log.userId],
    }));

    // Send the combined data as the response
    res.status(200).json({
      message: "Subscription logs fetched successfully",
      subscriptionLogs: combinedData,
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
    const userIds = [...new Set(subscriptionLogs.map((log) => log.userId))];

    // Step 3: Fetch user details for the extracted userIds
    const users = await Merchant.find({ _id: { $in: userIds } });

    // Step 4: Create a map of userId to user details for quick lookup
    const userMap = users.reduce((map, user) => {
      map[user._id] = user.merchantDetail.merchantName;
      return map;
    }, {});

    // Step 5: Combine subscription logs with the corresponding user details
    const combinedData = subscriptionLogs.map((log) => ({
      ...log.toObject(),
      user: userMap[log.userId],
    }));
    res.status(200).json({
      message: "Subscription logs fetched successfully",
      combinedData,
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
    const subscriptionLogsPromises = merchants.map(async (merchant) => {
      const logsWithUsersPromises = merchant.merchantDetail.pricing.map(
        async (pricingId) => {
          const log = await SubscriptionLog.findById(pricingId);
          const user = await Merchant.findById(log.userId); // Assuming log contains a reference to userId
          return {
            ...log._doc,
            user: `${user.merchantDetail.merchantName}`, // Adjust according to your User model
          };
        }
      );
      return await Promise.all(logsWithUsersPromises);
      // return await Promise.all(subscriptionLogsPromises);
    });

    const subscriptionLogs = await Promise.all(subscriptionLogsPromises);

    res.status(200).json(subscriptionLogs.flat());
  } catch (err) {
    next(appError(err.message));
  }
};

const getMerchantSubscriptionLogsByStartDate = async (req, res, next) => {
  try {
    const { startDate } = req.query;

    if (!startDate) {
      return res.status(400).json({ message: "Start date is required" });
    }

    // Parse the user-provided date using moment
    let inputDate = moment(startDate, moment.ISO_8601, true);

    // Check if the date is valid
    if (!inputDate.isValid()) {
      // Attempt to convert the invalid date format to a valid format
      const formattedDate = moment(startDate, "MM/DD/YYYY", true);

      // Check if the conversion to a valid format was successful
      if (!formattedDate.isValid()) {
        return res.status(400).json({
          message: "Invalid date format. Please use YYYY-MM-DD or MM/DD/YYYY.",
        });
      }

      inputDate = formattedDate;
    }

    // Get the start and end of the day
    const startOfDay = inputDate.startOf("day").toDate();
    const endOfDay = inputDate.endOf("day").toDate();
    // Find subscription logs by date range
    const subscriptionLogs = await SubscriptionLog.find({
      startDate: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
      typeOfUser: "Merchant",
    });

    if (subscriptionLogs.length === 0) {
      return res.status(404).json({
        message: "No subscription logs found for the provided start date",
      });
    }

    const userIds = [...new Set(subscriptionLogs.map((log) => log.userId))];

    // Step 3: Fetch user details for the extracted userIds
    const users = await Merchant.find({ _id: { $in: userIds } });

    // Step 4: Create a map of userId to user details for quick lookup
    const userMap = users.reduce((map, user) => {
      map[user._id] = user.merchantDetail.merchantName;
      return map;
    }, {});

    // Step 5: Combine subscription logs with the corresponding user details
    const combinedData = subscriptionLogs.map((log) => ({
      ...log.toObject(),
      user: userMap[log.userId],
    }));

    res.status(200).json({
      message: "Data fetched successfully",
      data: combinedData,
    });
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
    }).populate("customerDetails.pricing");

    if (customers.length === 0) {
      return res.status(404).json({ message: "No customers found" });
    }

    const subscriptionLogsPromises = customers.map(async (customer) => {
      const logsWithUsersPromises = customer.customerDetails.pricing.map(
        async (pricingId) => {
          const log = await SubscriptionLog.findById(pricingId);
          const user = await Customer.findById(log.userId); // Assuming log contains a reference to userId
          return {
            ...log._doc,
            user: `${user.fullName}`, // Adjust according to your User model
          };
        }
      );
      return await Promise.all(logsWithUsersPromises);
      // return await Promise.all(subscriptionLogsPromises);
    });

    const subscriptionLogs = await Promise.all(subscriptionLogsPromises);

    res.status(200).json(subscriptionLogs.flat());
  } catch (err) {
    next(appError(err.message));
  }
};

const getCustomerSubscriptionLogsByStartDate = async (req, res, next) => {
  try {
    const { startDate } = req.query;

    if (!startDate) {
      return res.status(400).json({ message: "Start date is required" });
    }

    // Parse the user-provided date using moment
    let inputDate = moment(startDate, moment.ISO_8601, true);

    // Check if the date is valid
    if (!inputDate.isValid()) {
      // Attempt to convert the invalid date format to a valid format
      const formattedDate = moment(startDate, "MM/DD/YYYY", true);

      // Check if the conversion to a valid format was successful
      if (!formattedDate.isValid()) {
        return res.status(400).json({
          message: "Invalid date format. Please use YYYY-MM-DD or MM/DD/YYYY.",
        });
      }

      inputDate = formattedDate;
    }

    // Get the start and end of the day
    const startOfDay = inputDate.startOf("day").toDate();
    const endOfDay = inputDate.endOf("day").toDate();
    // Find subscription logs by date range
    const subscriptionLogs = await SubscriptionLog.find({
      startDate: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
      typeOfUser: "Customer",
    });

    if (subscriptionLogs.length === 0) {
      return res.status(404).json({
        message: "No subscription logs found for the provided start date",
      });
    }
    const userIds = [...new Set(subscriptionLogs.map((log) => log.userId))];

    // Step 3: Fetch user details for the extracted userIds
    const users = await Merchant.find({ _id: { $in: userIds } });

    // Step 4: Create a map of userId to user details for quick lookup
    const userMap = users.reduce((map, user) => {
      map[user._id] = user.merchantDetail.merchantName;
      return map;
    }, {});

    // Step 5: Combine subscription logs with the corresponding user details
    const combinedData = subscriptionLogs.map((log) => ({
      ...log.toObject(),
      user: userMap[log.userId],
    }));

    res.status(200).json({
      message: "Data fetched successfully",
      data: combinedData,
    });
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
  getCustomerSubscriptionLogsByStartDate,
  getCustomerSubscriptionLogsByName,
};
