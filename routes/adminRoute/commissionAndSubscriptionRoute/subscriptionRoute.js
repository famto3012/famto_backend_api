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
  currentSubscriptionDetailOfMerchant,
} = require("../../../controllers/admin/commissionAndSubscription/subscriptionController");

const subscriptionValidationRules = require("../../../middlewares/validators/subscriptionValidations");
const isAdminOrMerchant = require("../../../middlewares/isAdminOrMerchant");

const subscriptionRoute = express.Router();

// Merchant

subscriptionRoute.post(
  "/add-merchant-subscription",
  subscriptionValidationRules,
  isAuthenticated,
  isAdmin,
  addMerchantSubscriptionPlanController
);

subscriptionRoute.get(
  "/get-current-subscription",
  isAuthenticated,
  isAdminOrMerchant,
  currentSubscriptionDetailOfMerchant
);

subscriptionRoute.get(
  "/get-merchant-subscription",
  isAuthenticated,
  isAdminOrMerchant,
  getAllMerchantSubscriptionPlansController
);

subscriptionRoute.get(
  "/get-merchant-subscription/:id",
  isAuthenticated,
  isAdminOrMerchant,
  getSingleMerchantSubscriptionPlanController
);

subscriptionRoute.put(
  "/edit-merchant-subscription/:id",
  isAuthenticated,
  isAdmin,
  editMerchantSubscriptionPlanController
);

subscriptionRoute.delete(
  "/delete-merchant-subscription/:id",
  isAuthenticated,
  isAdmin,
  deleteMerchantSubscriptionPlanController
);

// Customer

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
