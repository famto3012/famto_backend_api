const express = require("express");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const {
  addAndEditCommissionController,
  getAllCommissionLogController,
  getCommissionLogsByMerchantName,
  getCommissionLogsByCreatedDate,
  getCommissionLogsByMerchantId,
  updateCommissionLogStatus,
  getCommissionDetailOfMerchant,
  fetchCommissionLogs,
} = require("../../../controllers/admin/commissionAndSubscription/commissionController");
const { body } = require("express-validator");
const isAdminOrMerchant = require("../../../middlewares/isAdminOrMerchant");

const commissionRoute = express.Router();

commissionRoute.post(
  "/add-commission",
  [
    body("commissionType")
      .trim()
      .notEmpty()
      .withMessage("Commission type is required"),
    body("merchantId").trim().notEmpty().withMessage("Merchant id is required"),
    body("commissionValue")
      .trim()
      .notEmpty()
      .withMessage("Commission value is required"),
  ],
  isAuthenticated,
  isAdmin,
  addAndEditCommissionController
);

commissionRoute.get(
  "/get-commission-log",
  isAuthenticated,
  isAdminOrMerchant,
  fetchCommissionLogs
);

commissionRoute.get(
  "/commission-detail",
  isAuthenticated,
  isAdminOrMerchant,
  getCommissionDetailOfMerchant
);

commissionRoute.put(
  "/commission-log/:commissionLogId",
  isAuthenticated,
  isAdmin,
  updateCommissionLogStatus
);

// TODO: Remove after V2
commissionRoute.get(
  "/all-commission-log",
  isAuthenticated,
  isAdmin,
  getAllCommissionLogController
);

// TODO: Remove after V2
commissionRoute.get(
  "/commission-log-name",
  isAuthenticated,
  isAdmin,
  getCommissionLogsByMerchantName
);

// TODO: Remove after V2
commissionRoute.get(
  "/commission-log-date",
  isAuthenticated,
  isAdminOrMerchant,
  getCommissionLogsByCreatedDate
);

// TODO: Remove after V2
commissionRoute.get(
  "/commission-log/:merchantId",
  isAuthenticated,
  isAdminOrMerchant,
  getCommissionLogsByMerchantId
);

module.exports = commissionRoute;
