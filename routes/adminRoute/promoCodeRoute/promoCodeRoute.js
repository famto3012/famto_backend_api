const express = require("express");
const { body } = require("express-validator");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const { upload } = require("../../../utils/imageOperation");
const {
  addPromoCodeController,
  editPromoCodeController,
  getAllPromoCodesController,
  deletePromoCodeController,
  editPromoCodeStatusController,
  updateAllPromoCodesStatusController,
} = require("../../../controllers/admin/promocode/promoCodeController");

const promoCodeRoute = express.Router();

promoCodeRoute.post(
  "/add-promocode",
  upload.single("promoImage"),
  [
    body("promoCode").notEmpty().withMessage("Promo code is required"),
    body("promoType").notEmpty().withMessage("Promo type is required"),
    body("discount").notEmpty().withMessage("Discount is required"),
    body("description").notEmpty().withMessage("Description is required"),
    body("fromDate").notEmpty().withMessage("From date is required"),
    body("toDate").notEmpty().withMessage("To date is required"),
    body("maxDiscountValue")
      .notEmpty()
      .withMessage("Max discount value is required"),
    body("minOrderAmount")
      .notEmpty()
      .withMessage("Min order amount is required"),
    body("maxAllowedUsers")
      .notEmpty()
      .withMessage("Max allowed users is required"),
    body("appliedOn").notEmpty().withMessage("applied on is required"),
    body("merchantId").notEmpty().withMessage("Merchant Id is required"),
    body("geofenceId").notEmpty().withMessage("Geofence id is required"),
  ],
  isAuthenticated,
  isAdmin,
  addPromoCodeController
);

promoCodeRoute.put(
  "/edit-promocode/:id",
  upload.single("promoImage"),
  isAuthenticated,
  isAdmin,
  editPromoCodeController
);

promoCodeRoute.get(
  "/get-promocode",
  isAuthenticated,
  isAdmin,
  getAllPromoCodesController
);

promoCodeRoute.delete(
  "/delete-promocode/:id",
  isAuthenticated,
  isAdmin,
  deletePromoCodeController
);

promoCodeRoute.put(
  "/edit-promocode-status/:id",
  isAuthenticated,
  isAdmin,
  editPromoCodeStatusController
);

promoCodeRoute.put(
  "/edit-all-promocode",
  isAuthenticated,
  isAdmin,
  updateAllPromoCodesStatusController
);

module.exports = promoCodeRoute;
