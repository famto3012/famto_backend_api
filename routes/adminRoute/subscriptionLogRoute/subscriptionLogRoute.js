
const express = require("express");
const { body } = require("express-validator");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const { createSubscriptionLog, verifyRazorpayPayment, createSubscriptionLogUser, setAsPaidController, getAllMerchantSubscriptionLogController, getAllCustomerSubscriptionLogController, getByMerchantIdSubscriptionLogController, getMerchantSubscriptionLogsByName, getMerchantSubscriptionLogsByStartDate, getCustomerSubscriptionLogsByName } = require("../../../controllers/admin/commissionAndSubscription/subscriptionLogController");
const isAdmin = require("../../../middlewares/isAdmin");

const subscriptionLogRoute = express.Router();


subscriptionLogRoute.post(
  "/merchant-subscription-payment",
  isAuthenticated,
  isAdmin,
  createSubscriptionLog
);

subscriptionLogRoute.post(
  "/merchant-subscription-payment-verification",
  isAuthenticated,
  verifyRazorpayPayment
);

subscriptionLogRoute.post(
  "/customer-subscription-payment",
  isAuthenticated,
  isAdmin,
  createSubscriptionLog
);

subscriptionLogRoute.post(
  "/customer-subscription-payment-verification",
  isAuthenticated,
  verifyRazorpayPayment
);

subscriptionLogRoute.post(
  "/merchant-subscription-payment-user",
  isAuthenticated,
  createSubscriptionLogUser
);

subscriptionLogRoute.post(
  "/customer-subscription-payment-user",
  isAuthenticated,
  createSubscriptionLogUser
);

subscriptionLogRoute.put(
  "/merchant-subscription-status-update/:subscriptionId",
  isAuthenticated,
  isAdmin,
  setAsPaidController
);

subscriptionLogRoute.get(
  "/merchant-subscription-log",
  isAuthenticated,
  isAdmin,
  getAllMerchantSubscriptionLogController
);

subscriptionLogRoute.get(
  "/customer-subscription-log",
  isAuthenticated,
  isAdmin,
  getAllCustomerSubscriptionLogController
);

subscriptionLogRoute.get(
  "/merchant-subscription-log/:merchantId",
  isAuthenticated,
  isAdmin,
  getByMerchantIdSubscriptionLogController
);

subscriptionLogRoute.get(
  "/merchant-subscription-log-search",
  isAuthenticated,
  isAdmin,
  getMerchantSubscriptionLogsByName
);

subscriptionLogRoute.get(
  "/merchant-subscription-log-date",
  isAuthenticated,
  isAdmin,
  getMerchantSubscriptionLogsByStartDate
);

subscriptionLogRoute.get(
  "/customer-subscription-log-search",
  isAuthenticated,
  isAdmin,
  getCustomerSubscriptionLogsByName
);

module.exports = subscriptionLogRoute;
