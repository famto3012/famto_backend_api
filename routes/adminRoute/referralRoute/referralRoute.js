const express = require("express");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const {
  addOrUpdateReferralController,
  getReferralController,
  getReferralDetailController,
  updateReferralStatus,
} = require("../../../controllers/admin/referral/referralController");
const referralRoute = express.Router();

referralRoute.post(
  "/add-referral",
  isAuthenticated,
  isAdmin,
  addOrUpdateReferralController
);

referralRoute.put(
  "/edit-referral-status",
  isAuthenticated,
  isAdmin,
  updateReferralStatus
);

referralRoute.get(
  "/referral-criteria",
  isAuthenticated,
  isAdmin,
  getReferralController
);

referralRoute.get(
  "/referral-detail",
  isAuthenticated,
  isAdmin,
  getReferralDetailController
);

module.exports = referralRoute;
