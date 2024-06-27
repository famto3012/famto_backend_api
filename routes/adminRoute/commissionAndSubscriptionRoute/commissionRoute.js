const express = require("express");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const {
  addAndEditCommissionController,
} = require("../../../controllers/admin/commissionAndSubscription/commissionController");
const { body } = require("express-validator");

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


module.exports = commissionRoute