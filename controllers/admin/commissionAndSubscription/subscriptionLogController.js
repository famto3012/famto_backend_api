const { validationResult } = require("express-validator");
const ActivityLog = require("../../../models/ActivityLog");
const Commission = require("../../../models/Commission");
const Customer = require("../../../models/Customer");
const CustomerSubscription = require("../../../models/CustomerSubscription");
const Merchant = require("../../../models/Merchant");
const MerchantSubscription = require("../../../models/MerchantSubscription");
const SubscriptionLog = require("../../../models/SubscriptionLog");

const appError = require("../../../utils/appError");
const { formatDate } = require("../../../utils/formatters");
const {
  createRazorpayOrderId,
  verifyPayment,
} = require("../../../utils/razorpayPayment");

const createSubscriptionLog = async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().reduce((acc, error) => {
      acc[error.param] = error.msg;
      return acc;
    }, {});
    return res.status(400).json({ errors: formattedErrors });
  }

  try {
    const { planId, userId, paymentMode } = req.body;

    const merchant = await Merchant.findById(userId)
      .select("merchantDetail.pricing")
      .lean();

    const subscriptionPlan = merchant
      ? await MerchantSubscription.findById(planId)
      : await CustomerSubscription.findById(planId);

    if (!subscriptionPlan) return next(appError("Subscription not found", 404));

    const { amount, duration } = subscriptionPlan;

    if (paymentMode === "Online") {
      const { orderId, success, error } = await createRazorpayOrderId(amount);

      if (!success) {
        return res.status(500).json({
          message: "Failed to create Razorpay order",
          error,
        });
      }

      return res.status(201).json({
        message: "Subscription order created successfully",
        amount,
        orderId,
        currentPlan: planId,
        userId,
        paymentMode,
      });
    }

    let startDate = new Date();

    if (merchant?.merchantDetail?.pricing?.length > 0) {
      const latestPricing = merchant.merchantDetail.pricing[0];
      if (latestPricing.modelType === "Commission") {
        await Commission.findOneAndDelete({
          _id: latestPricing.modelId,
          merchantId: merchant._id,
        });
        merchant.merchantDetail.pricing = [];
      } else {
        const latestSub = await SubscriptionLog.findById(latestPricing.modelId);
        startDate = latestSub?.endDate || startDate;
      }
    }

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + duration);

    await SubscriptionLog.create({
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

    res.status(201).json({
      message: "Subscription order created successfully",
      amount,
      currentPlan: planId,
      userId,
      paymentMode,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const verifyRazorpayPayment = async (req, res, next) => {
  try {
    const paymentDetails = req.body;

    const isValidPayment = verifyPayment(paymentDetails);

    if (!isValidPayment) return next(appError("Invalid payment details", 400));

    const { razorpay_order_id, currentPlan, userId, paymentMode } =
      paymentDetails;

    const merchant = await Merchant.findById(userId);
    const subscriptionPlan = merchant
      ? await MerchantSubscription.findById(currentPlan)
      : await CustomerSubscription.findById(currentPlan);

    if (!subscriptionPlan)
      return next(appError("Subscription plan not found", 404));

    const customer = await Customer.findById(userId);

    const typeOfUser = merchant ? "Merchant" : "Customer";
    const user = merchant || customer;
    if (!user) return next(appError(`${typeOfUser} not found`, 404));

    const { amount, duration, maxOrders } = subscriptionPlan;

    const calculateStartDate = (pricingDetails) => {
      if (!pricingDetails?.length) return new Date();
      const latestSubscriptionId =
        pricingDetails[pricingDetails.length - 1].modelId;
      return SubscriptionLog.findById(latestSubscriptionId).then(
        (sub) => sub?.endDate || new Date()
      );
    };

    const startDate = await calculateStartDate(
      merchant ? merchant.merchantDetail.pricing : user.customerDetails.pricing
    );

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + duration);

    const subscriptionLog = await SubscriptionLog.create({
      planId: currentPlan,
      userId,
      amount,
      paymentMode,
      startDate,
      endDate,
      typeOfUser,
      maxOrders,
      paymentStatus: "Paid",
      razorpayOrderId: razorpay_order_id,
    });

    // Update user subscription details
    const updateUserPricing = async () => {
      if (merchant) {
        if (merchant.merchantDetail.pricing?.[0]?.modelType === "Commission") {
          await Commission.findOneAndDelete({
            _id: merchant.merchantDetail.pricing[0].modelId,
            merchantId: merchant._id,
          });
          merchant.merchantDetail.pricing = [];
        }
        merchant.merchantDetail.pricing.push({
          modelType: "Subscription",
          modelId: subscriptionLog._id,
        });
        await merchant.save();
      } else {
        user.customerDetails.pricing.push(subscriptionLog._id);
        user.transactionDetail.push({
          transactionAmount: amount,
          transactionType: "Subscription",
          madeOn: new Date(),
          type: "Debit",
        });
        await user.save();
      }
    };

    await updateUserPricing();

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

    const log = await SubscriptionLog.findById(subscriptionId);

    if (!log) return next(appError("Log not found", 404));

    const typeOfUser = log.typeOfUser;

    if (typeOfUser === "Merchant") {
      const merchantFound = await Merchant.findById(log.userId);

      merchantFound.merchantDetail.pricing.push({
        modelType: "Subscription",
        modelId: log._id,
      });

      await Promise.all([
        merchantFound.save(),
        SubscriptionLog.findByIdAndUpdate(
          subscriptionId,
          {
            paymentStatus: "Paid",
          },
          { new: true }
        ),
        ActivityLog.create({
          userId: req.userAuth,
          userType: req.userRole,
          description: `Subscription payment status of ${typeOfUser} (${log.userId}) is updated by Admin (${req.userAuth})`,
        }),
      ]);
    }

    res.status(200).json({
      message: "Subscription log updated successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Merchant

// TODO: Remove after panel V2
const getAllMerchantSubscriptionLogController = async (req, res, next) => {
  try {
    // Step 1: Fetch all subscription logs for Merchants
    const subscriptionLogs = await SubscriptionLog.find({
      typeOfUser: "Merchant",
    }).sort({ createdAt: -1 });

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

// TODO: Remove after panel V2
const getByMerchantIdSubscriptionLogController = async (req, res, next) => {
  try {
    const { merchantId } = req.params;

    const subscriptionLogs = await SubscriptionLog.find({
      userId: merchantId,
    }).sort({ createdAt: -1 });

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

// TODO: Remove after panel V2
const getMerchantSubscriptionLogsByName = async (req, res, next) => {
  const { name } = req.query;

  try {
    // Find merchants whose names start with the given letter, case-insensitive
    const merchants = await Merchant.find({
      "merchantDetail.merchantName": new RegExp(`^${name}`, "i"),
    })
      .populate("merchantDetail.pricing")
      .sort({ createdAt: -1 });

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

// TODO: Remove after panel V2
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
      }).sort({ createdAt: -1 });
    } else {
      subscriptionLogs = await SubscriptionLog.find({
        startDate: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
        typeOfUser: "Merchant",
      }).sort({ createdAt: -1 });
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

const fetchAllMerchantSubscriptionLogs = async (req, res, next) => {
  try {
    let { page = 1, limit = 50, merchantId, merchantName, date } = req.query;

    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    const skip = (page - 1) * limit;

    // Build filter criteria
    const filterCriteria = { typeOfUser: "Merchant" };

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      filterCriteria.startDate = { $gte: startOfDay, $lte: endOfDay };
    }

    if (merchantName) {
      const merchants = await Merchant.find({
        "merchantDetail.merchantName": {
          $regex: merchantName.trim(),
          $options: "i",
        },
      }).select("_id");

      if (!merchants.length) {
        return res.status(200).json({ data: [], total: 0 });
      }

      filterCriteria.userId = { $in: merchants.map((m) => m._id.toString()) };
    }

    if (merchantId && merchantId.toLowerCase() !== "all")
      filterCriteria.userId = merchantId.trim();

    const [logs, totalDocuments] = await Promise.all([
      SubscriptionLog.find(filterCriteria)
        .skip(skip)
        .limit(limit)
        .sort({ startDate: -1 })
        .lean(),
      SubscriptionLog.countDocuments(filterCriteria),
    ]);

    if (!logs.length) {
      return res.status(200).json({ data: [], total: totalDocuments });
    }

    // Extract plan and merchant IDs
    const planIds = [...new Set(logs.map((log) => log.planId))];
    const userIds = [...new Set(logs.map((log) => log.userId))];

    // Fetch related data in parallel
    const [plans, merchants] = await Promise.all([
      MerchantSubscription.find({ _id: { $in: planIds } })
        .select("_id name")
        .lean(),
      Merchant.find({ _id: { $in: userIds } })
        .select("_id merchantDetail.merchantName")
        .lean(),
    ]);

    // Convert data to lookup maps
    const planMap = plans.reduce((acc, plan) => {
      acc[plan._id] = plan.name;
      return acc;
    }, {});

    const merchantMap = merchants.reduce((acc, merchant) => {
      acc[merchant._id] = merchant.merchantDetail?.merchantName || null;
      return acc;
    }, {});

    // Format response
    const formattedResponse = logs.map((log) => ({
      logId: log._id,
      merchantName: merchantMap[log.userId] || null,
      planName: planMap[log.planId] || null,
      amount: log.amount || null,
      paymentMode: log.paymentMode || null,
      startDate: formatDate(log.startDate),
      status: log.paymentStatus || null,
    }));

    res.status(200).json({ data: formattedResponse, total: totalDocuments });
  } catch (err) {
    next(appError(err.message));
  }
};

// Customer

// TODO: Remove after panel V2
const getAllCustomerSubscriptionLogController = async (req, res, next) => {
  try {
    // Step 1: Fetch all subscription logs for Customers
    const subscriptionLogs = await SubscriptionLog.find({
      typeOfUser: "Customer",
    }).sort({ createdAt: -1 });

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

// TODO: Remove after panel V2
const getCustomerSubscriptionLogsByName = async (req, res, next) => {
  const { name } = req.query;

  try {
    // Find customers whose names start with the given name, case-insensitive
    const customers = await Customer.find({
      fullName: new RegExp(`^${name}`, "i"),
    })
      .populate("customerDetails.pricing")
      .sort({ createdAt: -1 });

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

// TODO: Remove after panel V2
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
    }).sort({ createdAt: -1 });

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

const fetchAllCustomerSubscriptionLogs = async (req, res, next) => {
  try {
    let { page = 1, limit = 50, name, date } = req.query;

    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    const skip = (page - 1) * limit;

    // Build filter criteria
    const filterCriteria = { typeOfUser: "Customer" };

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      filterCriteria.startDate = { $gte: startOfDay, $lte: endOfDay };
    }

    if (name) {
      const matchingCustomers = await Customer.find({
        fullName: { $regex: name.trim(), $options: "i" },
      })
        .select("_id")
        .lean();

      if (!matchingCustomers.length) {
        return res.status(200).json({ data: [], total: 0 });
      }

      filterCriteria.userId = {
        $in: matchingCustomers.map((c) => c._id.toString()),
      };
    }

    const [logs, totalDocuments] = await Promise.all([
      await SubscriptionLog.find(filterCriteria)
        .skip(skip)
        .limit(limit)
        .sort({ startDate: -1 })
        .lean(),
      await SubscriptionLog.countDocuments(filterCriteria),
    ]);

    if (!logs.length) {
      return res.status(200).json({ data: [], total: totalDocuments });
    }

    // Extract unique IDs for population
    const planIds = [...new Set(logs.map((log) => log.planId))];
    const userIds = [...new Set(logs.map((log) => log.userId))];

    // Fetch related data in parallel
    const [plans, customers] = await Promise.all([
      CustomerSubscription.find({ _id: { $in: planIds } })
        .select("_id name")
        .lean(),
      Customer.find({ _id: { $in: userIds } })
        .select("_id fullName")
        .lean(),
    ]);

    // Create lookup maps for efficient matching
    const planMap = Object.fromEntries(
      plans.map((plan) => [plan._id.toString(), plan.name])
    );
    const customerMap = Object.fromEntries(
      customers.map((customer) => [customer._id.toString(), customer.fullName])
    );

    // Format response
    const formattedResponse = logs.map((log) => ({
      logId: log._id,
      customerId: log.userId,
      customerName: customerMap[log.userId] || "Unknown",
      plan: planMap[log.planId] || "Unknown Plan",
      amount: log.amount,
      paymentMode: log.paymentMode || null,
      startDate: formatDate(log.startDate),
      status: log.paymentStatus || null,
    }));

    res.status(200).json({ data: formattedResponse, total: totalDocuments });
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

  //
  fetchAllMerchantSubscriptionLogs,
  fetchAllCustomerSubscriptionLogs,
};
