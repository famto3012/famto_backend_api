const { validationResult } = require("express-validator");

const MerchantSubscription = require("../../../models/MerchantSubscription");
const CustomerSubscription = require("../../../models/CustomerSubscription");
const Tax = require("../../../models/Tax");

const appError = require("../../../utils/appError");
const ActivityLog = require("../../../models/ActivityLog");

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
      amount: totalAmount,
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
    const subscriptionPlans = await MerchantSubscription.find().populate(
      "taxId",
      "taxName"
    );

    res.status(200).json({
      message: "Subscription plans retrieved successfully",
      data: subscriptionPlans,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const editMerchantSubscriptionPlanController = async (req, res, next) => {
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
    const { name, amount, duration, taxId, renewalReminder, description } =
      req.body;

    const subscriptionPlan = await MerchantSubscription.findById(id);
    if (!subscriptionPlan) {
      return res.status(404).json({ message: "Subscription plan not found" });
    }

    subscriptionPlan.name = name !== undefined ? name : subscriptionPlan.name;
    subscriptionPlan.amount =
      amount !== undefined ? amount : subscriptionPlan.amount;
    subscriptionPlan.duration =
      duration !== undefined ? duration : subscriptionPlan.duration;
    subscriptionPlan.taxId =
      taxId !== undefined ? taxId : subscriptionPlan.taxId;
    subscriptionPlan.renewalReminder =
      renewalReminder !== undefined
        ? renewalReminder
        : subscriptionPlan.renewalReminder;
    subscriptionPlan.description =
      description !== undefined ? description : subscriptionPlan.description;

    // Save the updated subscription plan
    const updatedSubscriptionPlan = await subscriptionPlan.save();

    await ActivityLog.create({
      userId: req.userAuth,
      userType: req.userRole,
      description: `Merchant subscription plan (${name}) is updated by Admin (${req.userAuth})`,
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

    const subscriptionPlan = await MerchantSubscription.findById(id);

    if (!subscriptionPlan) {
      return res.status(404).json({ message: "Subscription plan not found" });
    }

    res.status(200).json({
      message: "Subscription plan retrieved successfully",
      data: subscriptionPlan,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const deleteMerchantSubscriptionPlanController = async (req, res, next) => {
  try {
    const { id } = req.params;

    const subscriptionPlan = await MerchantSubscription.findByIdAndDelete(id);

    if (!subscriptionPlan) {
      return next(appError("Subscription plan not found", 404));
    }

    await ActivityLog.create({
      userId: req.userAuth,
      userType: req.userRole,
      description: `Merchant subscription plan (${subscriptionPlan.name}) is deleted by Admin (${req.userAuth})`,
    });

    res.status(200).json({
      message: "Subscription plan deleted successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

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

    const subscriptionPlan = new CustomerSubscription({
      name,
      amount: totalAmount,
      duration,
      taxId: taxId || null,
      renewalReminder,
      noOfOrder,
      description,
    });

    const savedSubscriptionPlan = await subscriptionPlan.save();

    await ActivityLog.create({
      userId: req.userAuth,
      userType: req.userRole,
      description: `New Customer subscription plan (${name}) is created by Admin (${req.userAuth})`,
    });

    res.status(201).json({
      message: "Subscription plan added successfully",
      data: savedSubscriptionPlan,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAllCustomerSubscriptionPlansController = async (req, res, next) => {
  try {
    const subscriptionPlans = await CustomerSubscription.find().populate(
      "taxId",
      "taxName"
    );

    res.status(200).json({
      message: "Subscription plans retrieved successfully",
      data: subscriptionPlans,
    });
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
    if (taxId && !subscriptionPlan.taxId && taxId !== subscriptionPlan.taxId) {
      const taxFound = await Tax.findById(taxId);

      const taxAmount = amount * (taxFound.tax / 100);

      totalAmount = parseFloat(amount) + taxAmount;
    }

    let updatedSubPlan = await CustomerSubscription.findByIdAndUpdate(
      id,
      {
        name,
        amount: totalAmount,
        duration,
        taxId: taxId || null,
        renewalReminder,
        noOfOrder,
        description,
      },
      { new: true }
    );

    await ActivityLog.create({
      userId: req.userAuth,
      userType: req.userRole,
      description: `Customer subscription plan (${name}) is updated by Admin (${req.userAuth})`,
    });

    updatedSubPlan = await updatedSubPlan.populate("taxId", "taxName");

    res.status(200).json({
      message: "Subscription plan updated successfully",
      data: updatedSubPlan,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getSingleCustomerSubscriptionPlanController = async (req, res, next) => {
  try {
    const { id } = req.params;

    const subscriptionPlan = await CustomerSubscription.findById(id);

    if (!subscriptionPlan) {
      return res.status(404).json({ message: "Subscription plan not found" });
    }

    res.status(200).json({
      message: "Subscription plan retrieved successfully",
      data: subscriptionPlan,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const deleteCustomerSubscriptionPlanController = async (req, res, next) => {
  try {
    const { id } = req.params;

    const subscriptionPlan = await CustomerSubscription.findByIdAndDelete(id);

    if (!subscriptionPlan) {
      return next(appError("Subscription plan not found", 404));
    }

    await ActivityLog.create({
      userId: req.userAuth,
      userType: req.userRole,
      description: `Customer subscription plan (${subscriptionPlan.name}) is deleted by Admin (${req.userAuth})`,
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
  addCustomerSubscriptionPlanController,
  getAllCustomerSubscriptionPlansController,
  editCustomerSubscriptionPlanController,
  getSingleCustomerSubscriptionPlanController,
  deleteCustomerSubscriptionPlanController,
};
