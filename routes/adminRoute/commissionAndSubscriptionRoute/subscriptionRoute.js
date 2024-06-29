const express = require("express");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const {
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
} = require("../../../controllers/admin/commissionAndSubscription/subscriptionController");
const { body } = require("express-validator");
const subscriptionValidationRules = require("../../../middlewares/validators/subscriptionValidations");

const subscriptionRoute = express.Router();

subscriptionRoute.post(
  "/add-merchant-subscription",
  subscriptionValidationRules,
  isAuthenticated,
  isAdmin,
  addMerchantSubscriptionPlanController
);

subscriptionRoute.get(
  "/get-merchant-subscription",
  isAuthenticated,
  isAdmin,
  getAllMerchantSubscriptionPlansController
);

subscriptionRoute.put(
  "/edit-merchant-subscription/:id",
  isAuthenticated,
  isAdmin,
  editMerchantSubscriptionPlanController
);

subscriptionRoute.get(
  "/get-merchant-subscription/:id",
  isAuthenticated,
  isAdmin,
  getSingleMerchantSubscriptionPlanController
);

subscriptionRoute.delete(
  "/delete-merchant-subscription/:id",
  isAuthenticated,
  isAdmin,
  deleteMerchantSubscriptionPlanController
);

subscriptionRoute.post(
  "/add-customer-subscription",
  subscriptionValidationRules,
  isAuthenticated,
  isAdmin,
  addCustomerSubscriptionPlanController
);

subscriptionRoute.get(
  "/get-customer-subscription",
  isAuthenticated,
  isAdmin,
  getAllCustomerSubscriptionPlansController
);

subscriptionRoute.put(
  "/edit-customer-subscription/:id",
  isAuthenticated,
  isAdmin,
  editCustomerSubscriptionPlanController
);

subscriptionRoute.get(
  "/get-customer-subscription/:id",
  isAuthenticated,
  isAdmin,
  getSingleCustomerSubscriptionPlanController
);

subscriptionRoute.delete(
  "/delete-customer-subscription/:id",
  isAuthenticated,
  isAdmin,
  deleteCustomerSubscriptionPlanController
);

module.exports = subscriptionRoute;
