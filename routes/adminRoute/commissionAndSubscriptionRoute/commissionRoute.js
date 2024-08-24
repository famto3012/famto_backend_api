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
  "/all-commission-log",
  isAuthenticated,
  isAdmin,
  getAllCommissionLogController
);

commissionRoute.get(
  "/commission-log-name",
  isAuthenticated,
  isAdmin,
  getCommissionLogsByMerchantName
);

commissionRoute.get(
  "/commission-log-date",
  isAuthenticated,
  isAdmin,
  getCommissionLogsByCreatedDate
);

commissionRoute.get(
  "/commission-log/:merchantId",
  isAuthenticated,
  isAdmin,
  getCommissionLogsByMerchantId
);

commissionRoute.put(
  "/commission-log/:commissionLogId",
  isAuthenticated,
  isAdmin,
  updateCommissionLogStatus
);

commissionRoute.get(
  "/commission-detail",
  isAuthenticated,
  isAdminOrMerchant,
  getCommissionDetailOfMerchant
);

module.exports = commissionRoute;
