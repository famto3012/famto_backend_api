const { validationResult } = require("express-validator");

const MerchantSubscription = require("../../../models/MerchantSubscription");
const CustomerSubscription = require("../../../models/CustomerSubscription");
const ActivityLog = require("../../../models/ActivityLog");
const Tax = require("../../../models/Tax");

const appError = require("../../../utils/appError");
const SubscriptionLog = require("../../../models/SubscriptionLog");
const Merchant = require("../../../models/Merchant");

// Merchant Subscription Plan
// ===========================
const addMerchantSubscriptionPlanController = async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    let formattedErrors = {};
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(400).json({ errors: formattedErrors });
  }

  try {
    const { name, amount, duration, taxId, renewalReminder, description } =
      req.body;

    let totalAmount = amount;
    if (taxId) {
      const tax = await Tax.findById(taxId);
      const taxAmount = amount * (tax.tax / 100);
      totalAmount = parseFloat(amount) + taxAmount;
    }

    const subscriptionPlan = new MerchantSubscription({
      name,
      amount: Math.round(totalAmount),
      duration,
      taxId: taxId || null,
      renewalReminder,
      description,
    });

    const savedSubscriptionPlan = await subscriptionPlan.save();

    await ActivityLog.create({
      userId: req.userAuth,
      userType: req.userRole,
      description: `New Merchant subscription plan (${name}) is created by Admin (${req.userAuth})`,
    });

    res.status(201).json({
      message: "Subscription plan added successfully",
      data: savedSubscriptionPlan,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAllMerchantSubscriptionPlansController = async (req, res, next) => {
  try {
    const plans = await MerchantSubscription.find().populate(
      "taxId",
      "taxName"
    );

    const formattedResponse = plans?.map((plan) => ({
      planId: plan._id,
      name: plan.name || null,
      amount: plan.amount || null,
      duration: plan.duration || null,
      taxName: plan.taxId.taxName || null,
      renewalReminder: plan.renewalReminder || null,
    }));

    res.status(200).json(formattedResponse);
  } catch (err) {
    next(appError(err.message));
  }
};

const editMerchantSubscriptionPlanController = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().reduce((acc, error) => {
      acc[error.path] = error.msg;
      return acc;
    }, {});
    return res.status(400).json({ errors: formattedErrors });
  }

  try {
    const { id } = req.params;
    const { name, amount, duration, taxId, renewalReminder, description } =
      req.body;

    const subscriptionPlan = await MerchantSubscription.findById(id);
    if (!subscriptionPlan) {
      return res.status(404).json({ message: "Subscription plan not found" });
    }

    // TODO:Need to recheck the amount calculation when updating only the price
    // Calculate the new total amount only if the taxId changes
    let totalAmount = amount;
    if (
      amount !== subscriptionPlan.amount ||
      taxId.toString() !== subscriptionPlan.taxId?.toString()
    ) {
      const oldTax = await Tax.findById(subscriptionPlan.taxId);
      const baseAmount = amount / (1 + oldTax?.tax / 100);

      const newTax = await Tax.findById(taxId);
      const taxAmount = baseAmount * (newTax?.tax / 100);
      totalAmount = Math.round(baseAmount + taxAmount);
    }

    console.log("AMOUNT", totalAmount);

    // Update subscription plan fields if provided
    const updatedFields = {
      ...(name && { name }),
      ...(amount && { amount: totalAmount }),
      ...(duration && { duration }),
      ...(taxId && { taxId }),
      ...(renewalReminder && { renewalReminder }),
      ...(description && { description }),
    };

    const updatedSubscriptionPlan =
      await MerchantSubscription.findByIdAndUpdate(
        id,
        { $set: updatedFields },
        { new: true, runValidators: true }
      );

    await ActivityLog.create({
      userId: req.userAuth,
      userType: req.userRole,
      description: `Merchant subscription plan (${updatedSubscriptionPlan.name}) updated by Admin (${req.userAuth})`,
    });

    res.status(200).json({
      message: "Subscription plan updated successfully",
      data: updatedSubscriptionPlan,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getSingleMerchantSubscriptionPlanController = async (req, res, next) => {
  try {
    const { id } = req.params;

    const plan = await MerchantSubscription.findById(id);

    if (!plan) return next(appError("Subscription plan not found", 404));

    const formattedResponse = {
      planId: plan._id,
      name: plan.name || null,
      amount: plan.amount || null,
      duration: plan.duration || null,
      taxId: plan.taxId || null,
      renewalReminder: plan.renewalReminder || null,
    };

    res.status(200).json(formattedResponse);
  } catch (err) {
    next(appError(err.message));
  }
};

const deleteMerchantSubscriptionPlanController = async (req, res, next) => {
  try {
    const { id } = req.params;

    const plan = await MerchantSubscription.findByIdAndDelete(id);

    if (!plan) {
      return next(appError("Subscription plan not found", 404));
    }

    await ActivityLog.create({
      userId: req.userAuth,
      userType: req.userRole,
      description: `Merchant subscription plan (${plan.name}) is deleted by Admin (${req.userAuth})`,
    });

    res.status(200).json({
      message: "Subscription plan deleted successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const currentSubscriptionDetailOfMerchant = async (req, res, next) => {
  try {
    const merchantId = req.userAuth;

    const merchant = await Merchant.findById(merchantId)
      .select("merchantDetail.pricing")
      .lean();

    if (!merchant) return next(appError("Merchant not found", 404));

    let planLog;
    if (merchant.merchantDetail?.pricing?.length > 0) {
      const subscriptionPlans = merchant.merchantDetail?.pricing?.filter(
        (plan) => plan.modelType === "Subscription"
      );

      if (subscriptionPlans?.length > 0) {
        planLog = await SubscriptionLog.findById(
          subscriptionPlans[0].modelId
        ).populate("planId", "name");
      }
    }

    const formattedResponse = {
      planName: planLog.planId.name || null,
      daysLeft: 30 || 1,
    };

    res.status(200).json(formattedResponse);
  } catch (err) {
    next(appError(err.messages));
  }
};

// Customer Subscription Plan
// ===========================
const addCustomerSubscriptionPlanController = async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    let formattedErrors = {};
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(400).json({ errors: formattedErrors });
  }

  try {
    const {
      name,
      amount,
      duration,
      taxId,
      noOfOrder,
      renewalReminder,
      description,
    } = req.body;

    let totalAmount = amount;
    if (taxId) {
      const tax = await Tax.findById(taxId);
      const taxAmount = amount * (tax.tax / 100);
      totalAmount = parseFloat(amount) + taxAmount;
    }

    const [newPlan, _] = await Promise.all([
      await CustomerSubscription.create({
        name,
        amount: Math.round(totalAmount),
        duration,
        taxId: taxId || null,
        renewalReminder,
        noOfOrder,
        description,
      }),
      await ActivityLog.create({
        userId: req.userAuth,
        userType: req.userRole,
        description: `New Customer subscription plan (${name}) is created by Admin (${req.userAuth})`,
      }),
    ]);

    res.status(201).json({
      message: "Subscription plan added successfully",
      data: newPlan,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAllCustomerSubscriptionPlansController = async (req, res, next) => {
  try {
    const plans = await CustomerSubscription.find().populate(
      "taxId",
      "taxName"
    );

    const formattedResponse = plans?.map((plan) => ({
      planId: plan._id,
      title: plan.title || null,
      name: plan.name || null,
      amount: plan.amount || null,
      duration: plan.duration || null,
      taxName: plan?.taxId?.taxName || null,
      renewalReminder: plan.renewalReminder || null,
      noOfOrder: plan.noOfOrder || null,
    }));

    res.status(200).json(formattedResponse);
  } catch (err) {
    next(appError(err.message));
  }
};

const editCustomerSubscriptionPlanController = async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    let formattedErrors = {};
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(400).json({ errors: formattedErrors });
  }

  try {
    const { id } = req.params;
    const {
      name,
      amount,
      duration,
      taxId,
      noOfOrder,
      renewalReminder,
      description,
    } = req.body;

    const subscriptionPlan = await CustomerSubscription.findById(id);

    if (!subscriptionPlan) {
      return next(appError("Subscription plan not found", 404));
    }

    let totalAmount = amount;

    if (!subscriptionPlan.taxId && taxId) {
      // Scenario 1: Tax not set initially, add tax now
      const tax = await Tax.findById(taxId);
      const taxAmount = amount * (tax.tax / 100);
      totalAmount = parseFloat(amount) + taxAmount;
    } else if (
      subscriptionPlan.taxId &&
      taxId &&
      taxId.toString() !== subscriptionPlan.taxId.toString()
    ) {
      // Scenario 2: Existing tax is being changed to a new tax
      const oldTax = await Tax.findById(subscriptionPlan.taxId);
      const baseAmount = amount / (1 + oldTax.tax / 100);
      const newTax = await Tax.findById(taxId);
      const taxAmount = baseAmount * (newTax.tax / 100);
      totalAmount = parseFloat(baseAmount) + taxAmount;
    } else if (subscriptionPlan.taxId && !taxId) {
      // Scenario 3: Existing tax is being removed
      const oldTax = await Tax.findById(subscriptionPlan.taxId);
      const baseAmount = amount / (1 + oldTax.tax / 100);
      totalAmount = parseFloat(baseAmount); // No new tax is applied, use base amount only
    }

    let [updatedPlan, _] = await Promise.all([
      await CustomerSubscription.findByIdAndUpdate(
        id,
        {
          name,
          amount: Math.round(totalAmount),
          duration,
          taxId: taxId || null,
          renewalReminder,
          noOfOrder,
          description,
        },
        { new: true }
      ),
      await ActivityLog.create({
        userId: req.userAuth,
        userType: req.userRole,
        description: `Customer subscription plan (${name}) is updated by Admin (${req.userAuth})`,
      }),
    ]);

    updatedPlan = await updatedPlan.populate("taxId", "taxName");

    res.status(200).json({
      message: "Subscription plan updated successfully",
      data: updatedPlan,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getSingleCustomerSubscriptionPlanController = async (req, res, next) => {
  try {
    const { id } = req.params;

    const plan = await CustomerSubscription.findById(id);

    if (!plan) return next(appError("Subscription plan not found", 404));

    const formattedResponse = {
      planId: plan._id,
      name: plan.name || null,
      amount: plan.amount || null,
      duration: plan.duration || null,
      taxId: plan.taxId || null,
      renewalReminder: plan.renewalReminder || null,
    };

    res.status(200).json(formattedResponse);
  } catch (err) {
    next(appError(err.message));
  }
};

const deleteCustomerSubscriptionPlanController = async (req, res, next) => {
  try {
    const { id } = req.params;

    const plan = await CustomerSubscription.findByIdAndDelete(id);

    if (!plan) return next(appError("Subscription plan not found", 404));

    await ActivityLog.create({
      userId: req.userAuth,
      userType: req.userRole,
      description: `Customer subscription plan (${plan.name}) is deleted by Admin (${req.userAuth})`,
    });

    res.status(200).json({
      message: "Subscription plan deleted successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  addMerchantSubscriptionPlanController,
  getAllMerchantSubscriptionPlansController,
  editMerchantSubscriptionPlanController,
  getSingleMerchantSubscriptionPlanController,
  deleteMerchantSubscriptionPlanController,
  currentSubscriptionDetailOfMerchant,
  //
  addCustomerSubscriptionPlanController,
  getAllCustomerSubscriptionPlansController,
  editCustomerSubscriptionPlanController,
  getSingleCustomerSubscriptionPlanController,
  deleteCustomerSubscriptionPlanController,
};
