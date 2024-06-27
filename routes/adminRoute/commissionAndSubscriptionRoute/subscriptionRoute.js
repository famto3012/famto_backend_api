const express = require("express");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const {
  addMerchantSubscriptionPlanController,
  getAllMerchantSubscriptionPlansController,
  editMerchantSubscriptionPlanController,
  getSingleMerchantSubscriptionPlanController,
  deleteMerchantSubscriptionPlanController,
} = require("../../../controllers/admin/commissionAndSubscription/subscriptionController");
const { body } = require("express-validator");
const subscriptionValidationRules = require("../../../middlewares/validators/subscriptionValidations");

const subscriptionRoute = express.Router();

subscriptionRoute.post(
  "/add-subscription",
  subscriptionValidationRules,
  isAuthenticated,
  isAdmin,
  addMerchantSubscriptionPlanController
);

subscriptionRoute.get(
  "/get-subscription",
  isAuthenticated,
  isAdmin,
  getAllMerchantSubscriptionPlansController
);

subscriptionRoute.put(
  "/edit-subscription/:id",
  isAuthenticated,
  isAdmin,
  editMerchantSubscriptionPlanController
);

subscriptionRoute.get(
  "/get-subscription/:id",
  isAuthenticated,
  isAdmin,
  getSingleMerchantSubscriptionPlanController
);

subscriptionRoute.delete(
  "/delete-subscription/:id",
  isAuthenticated,
  isAdmin,
  deleteMerchantSubscriptionPlanController
);


module.exports = subscriptionRoute;
