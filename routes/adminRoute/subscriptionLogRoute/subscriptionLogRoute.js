
const express = require("express");
const { body } = require("express-validator");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const { createSubscriptionLog, verifyRazorpayPayment } = require("../../../controllers/admin/commissionAndSubscription/subscriptionLogController");

const subscriptionLogRoute = express.Router();


subscriptionLogRoute.post(
  "/merchant-subscription-payment",
  isAuthenticated,
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
  createSubscriptionLog
);

subscriptionLogRoute.post(
  "/customer-subscription-payment-verification",
  isAuthenticated,
  verifyRazorpayPayment
);

module.exports = subscriptionLogRoute;
