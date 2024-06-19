const express = require("express");
const loyaltyPointRoute = express.Router();

const {
  addLoyaltyPointController,
  getLoyaltyPointController,
  updateStatusController,
} = require("../../../controllers/admin/loyaltyPoint/loyaltyPointController");
const isAdmin = require("../../../middlewares/isAdmin");
const { body } = require("express-validator");
const isAuthenticated = require("../../../middlewares/isAuthenticated");

//Create / Update loyalty point criteria
loyaltyPointRoute.post(
  "/add-loyalty-point",
  [
    body("earningCriteraRupee")
      .trim()
      .notEmpty()
      .withMessage("Earning critera rupee is required"),
    body("earningCriteraPoint")
      .trim()
      .notEmpty()
      .withMessage("Earning critera point is required"),
    body("minOrderAmountForEarning")
      .trim()
      .notEmpty()
      .withMessage("Minimum order amount for earning is required"),
    body("maxEarningPoint")
      .trim()
      .notEmpty()
      .withMessage("Max earning point is required"),
    body("expiryDuration")
      .trim()
      .notEmpty()
      .withMessage("Expiry duration is required"),
    body("redemptionCriteraPoint")
      .trim()
      .notEmpty()
      .withMessage("Redemption criteria point is required"),
    body("redemptionCriteraRupee")
      .trim()
      .notEmpty()
      .withMessage("Redemption criteria rupee is required"),
    body("minOrderAmountForRedemption")
      .trim()
      .notEmpty()
      .withMessage("Minimum order amount for redemption is required"),
    body("minLoyaltyPointForRedemption")
      .trim()
      .notEmpty()
      .withMessage("Minimum loyalty point for redemption is required"),
    body("minRedemptionAmountPercentage")
      .trim()
      .notEmpty()
      .withMessage("Minimum redemption amount percentage is required"),
  ],
  isAdmin,
  addLoyaltyPointController
);

//Get loyalty point criteria
loyaltyPointRoute.get("/", isAuthenticated, isAdmin, getLoyaltyPointController);

//Update loyalty point criteria
loyaltyPointRoute.patch("/", isAuthenticated, isAdmin, updateStatusController);

module.exports = loyaltyPointRoute;
