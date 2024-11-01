const ActivityLog = require("../../../models/ActivityLog");
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

    if (!subscriptionPlan) return next(appError("Subscription not found", 404));

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
        let sub;
        if (merchant.merchantDetail.pricing[0].modelType === "Commission") {
          merchant.merchantDetail.pricing = [];
        } else {
          sub = await SubscriptionLog.findById(
            merchant.merchantDetail.pricing[
              merchant.merchantDetail.pricing.length - 1
            ].modelId
          );
        }

        startDate = sub?.endDate || new Date();
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
          ].modelId
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
          ].modelId
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
      if (merchantFound.merchantDetail.pricing[0].modelType === "Commission") {
        merchantFound.merchantDetail.pricing = [];
      }

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
      console.log("Inside Cash");
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
          ].modelId
        );

        sub?.endDate ? (startDate = sub.endDate) : (startDate = new Date());
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

      if (merchantFound.merchantDetail.pricing.length >= 1) {
        merchantFound.merchantDetail.pricing = [];
      }

      merchantFound.merchantDetail.pricing.push({
        modelType: "Subscription",
        modelId: subscriptionLog._id,
      });

      await merchantFound.save();
    }

    if (!subscriptionLog) {
      return next(appError("Subscription log not found", 404));
    }

    await ActivityLog.create({
      userId: req.userAuth,
      userType: req.userRole,
      description: `Subscription payment status of ${typeOfUser} (${subscriptionLog.userId}) is updated by Admin (${req.userAuth})`,
    });

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

    // Step 2: Extract unique userIds and planIds from the subscription logs
    const userIds = [...new Set(subscriptionLogs.map((log) => log.userId))];
    const planIds = [...new Set(subscriptionLogs.map((log) => log.planId))];

    // Step 3: Fetch user details for the extracted userIds
    const users = await Merchant.find({ _id: { $in: userIds } });

    // Step 4: Fetch plan details for the extracted planIds
    const plans = await MerchantSubscription.find({ _id: { $in: planIds } });

    // Step 5: Create a map of userId to user details for quick lookup
    const userMap = users.reduce((map, user) => {
      map[user._id] = user.merchantDetail.merchantName;
      return map;
    }, {});

    // Step 6: Create a map of planId to plan details for quick lookup
    const planMap = plans.reduce((map, plan) => {
      map[plan._id] = plan.name; // Assuming `planName` is the name of the plan
      return map;
    }, {});

    // Step 7: Combine subscription logs with the corresponding user and plan details
    const combinedData = subscriptionLogs.map((log) => ({
      ...log.toObject(),
      user: userMap[log.userId],
      plan: planMap[log.planId],
    }));

    // Send the combined data as the response
    res.status(200).json({
      message: "Subscription logs fetched successfully",
      data: combinedData,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAllCustomerSubscriptionLogController = async (req, res, next) => {
  try {
    // Step 1: Fetch all subscription logs for Customers
    const subscriptionLogs = await SubscriptionLog.find({
      typeOfUser: "Customer",
    });

    // Step 2: Extract unique userIds and planIds from the subscription logs
    const userIds = [...new Set(subscriptionLogs.map((log) => log.userId))];
    const planIds = [...new Set(subscriptionLogs.map((log) => log.planId))];

    // Step 3: Fetch user details for the extracted userIds
    const users = await Customer.find({ _id: { $in: userIds } });

    // Step 4: Fetch plan details for the extracted planIds from CustomerSubscription
    const plans = await CustomerSubscription.find({ _id: { $in: planIds } });

    // Step 5: Create a map of userId to user details for quick lookup
    const userMap = users.reduce((map, user) => {
      map[user._id] = user.fullName; // Assuming user has fullName property
      return map;
    }, {});

    // Step 6: Create a map of planId to plan details for quick lookup
    const planMap = plans.reduce((map, plan) => {
      map[plan._id] = plan.name; // Assuming CustomerSubscription has a planName property
      return map;
    }, {});

    // Step 7: Combine subscription logs with the corresponding user and plan details
    const combinedData = subscriptionLogs.map((log) => ({
      ...log.toObject(),
      user: userMap[log.userId],
      plan: planMap[log.planId],
    }));

    // Send the combined data as the response
    res.status(200).json({
      message: "Subscription logs fetched successfully",
      data: combinedData,
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

    const planIds = [...new Set(subscriptionLogs.map((log) => log.planId))];

    const plans = await MerchantSubscription.find({ _id: { $in: planIds } });

    const userIds = [...new Set(subscriptionLogs.map((log) => log.userId))];

    // Step 3: Fetch user details for the extracted userIds
    const users = await Merchant.find({ _id: { $in: userIds } });

    // Step 4: Create a map of userId to user details for quick lookup
    const userMap = users.reduce((map, user) => {
      map[user._id] = user.merchantDetail.merchantName;
      return map;
    }, {});

    const planMap = plans.reduce((map, plan) => {
      map[plan._id] = plan.name; // Assuming `planName` is the name of the plan
      return map;
    }, {});

    // Step 5: Combine subscription logs with the corresponding user details
    const combinedData = subscriptionLogs.map((log) => ({
      ...log.toObject(),
      user: userMap[log.userId],
      plan: planMap[log.planId],
    }));

    res.status(200).json({
      message: "Subscription logs fetched successfully",
      data: combinedData,
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
      return res.status(200).json({ message: "No merchants found", data: [] });
    }

    // Extract subscription logs from all matching merchants
    const subscriptionLogsPromises = merchants.map(async (merchant) => {
      const logsWithUsersPromises = merchant.merchantDetail.pricing.map(
        async (pricing) => {
          const log = await SubscriptionLog.findById(pricing.modelId);
          if (!log) return null;

          const user = await Merchant.findById(log.userId); // Assuming log contains a reference to userId

          // Fetch the plan details (assuming `planId` references a Plan model)
          const plan = await MerchantSubscription.findById(log.planId);

          return {
            ...log._doc,
            user: user ? `${user.merchantDetail.merchantName}` : null, // Adjust according to your User model
            planName: plan ? plan.name : null, // Assuming the plan has a `name` field
          };
        }
      );
      return await Promise.all(logsWithUsersPromises);
    });

    const subscriptionLogs = await Promise.all(subscriptionLogsPromises);

    res.status(200).json(subscriptionLogs.flat());
  } catch (err) {
    next(appError(err.message));
  }
};

const getMerchantSubscriptionLogsByStartDate = async (req, res, next) => {
  try {
    const { startDate, merchantId } = req.query;

    if (!startDate) return next(appError("Date is required", 400));

    let startOfDay = new Date(startDate);
    startOfDay.setHours(0, 0, 0, 0);

    let endOfDay = new Date(startDate);
    endOfDay.setHours(23, 59, 59, 999);

    let subscriptionLogs;

    if (merchantId) {
      subscriptionLogs = await SubscriptionLog.find({
        startDate: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
        typeOfUser: "Merchant",
        userId: merchantId,
      });
    } else {
      subscriptionLogs = await SubscriptionLog.find({
        startDate: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
        typeOfUser: "Merchant",
      });
    }

    if (subscriptionLogs.length === 0) {
      return res.status(200).json({
        message: "No subscription logs found for the provided start date",
        data: [],
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
    // Find customers whose names start with the given name, case-insensitive
    const customers = await Customer.find({
      fullName: new RegExp(`^${name}`, "i"),
    }).populate("customerDetails.pricing");

    if (customers.length === 0) {
      return res.status(200).json({ message: "No customers found", data: [] });
    }

    // Extract subscription logs from all matching customers
    const subscriptionLogsPromises = customers.map(async (customer) => {
      const logsWithUsersPromises = customer.customerDetails.pricing.map(
        async (pricingId) => {
          // Fetch the subscription log
          const log = await SubscriptionLog.findById(pricingId);

          if (!log) return null; // If the log is not found, return null

          // Fetch the customer details based on userId
          const user = await Customer.findById(log.userId);

          if (!user) return null; // If the user is not found, return null

          // Assuming you have a Plan model and want to include the plan name
          const plan = await CustomerSubscription.findById(log.planId); // Adjust based on your schema

          return {
            ...log._doc,
            user: user ? user.fullName : null,
            plan: plan ? plan.name : null, // Add plan name if it exists
          };
        }
      );
      // Resolve all promises for this customer
      const logs = await Promise.all(logsWithUsersPromises);
      return logs;
    });

    // Wait for all promises to resolve and flatten the result
    const subscriptionLogs = (await Promise.all(subscriptionLogsPromises))
      .flat()
      .filter((log) => log !== null);

    res.status(200).json({
      message: "Customer subscription logs",
      data: subscriptionLogs,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getCustomerSubscriptionLogsByStartDate = async (req, res, next) => {
  try {
    const { startDate } = req.query;

    if (!startDate) return next(appError("Date is required", 400));

    let startOfDay = new Date(startDate);
    startOfDay.setHours(0, 0, 0, 0);

    let endOfDay = new Date(startDate);
    endOfDay.setHours(23, 59, 59, 999);

    const subscriptionLogs = await SubscriptionLog.find({
      startDate: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
      typeOfUser: "Customer",
    });

    if (subscriptionLogs.length === 0) {
      return res.status(200).json({
        message: "No subscription logs found for the provided start date",
        data: [],
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
