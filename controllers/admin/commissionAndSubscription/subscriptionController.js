const { validationResult } = require("express-validator");
const MerchantSubscription = require("../../../models/MerchantSubscription");
const appError = require("../../../utils/appError");

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

    const subscriptionPlan = new MerchantSubscription({
      name,
      amount,
      duration,
      taxId,
      renewalReminder,
      description,
    });

    const savedSubscriptionPlan = await subscriptionPlan.save();

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
    const subscriptionPlans = await MerchantSubscription.find();

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
      return res.status(404).json({ message: "Subscription plan not found" });
    }

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
  deleteMerchantSubscriptionPlanController
};
