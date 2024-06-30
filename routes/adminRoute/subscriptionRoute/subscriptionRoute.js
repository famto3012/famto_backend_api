
const express = require("express");
const { body } = require("express-validator");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const { createSubscriptionLog, verifyRazorpayPayment } = require("../../../controllers/admin/commissionAndSubscription/subscriptionLogController");

const subscriptionRoute = express.Router();


subscriptionRoute.post(
  "/merchant-subscription-payment",
  isAuthenticated,
  createSubscriptionLog
);

subscriptionRoute.post(
  "/merchant-subscription-payment-verification",
  isAuthenticated,
  verifyRazorpayPayment
);

module.exports = subscriptionRoute;
