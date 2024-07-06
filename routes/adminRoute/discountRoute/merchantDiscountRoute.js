const express = require("express");
const { body } = require("express-validator");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const {
  addDiscountController,
  editDiscountController,
  deleteDiscountController,
  getAllDiscountController,
  updateDiscountStatusController,
  updateAllDiscountController,
  addDiscountAdminController,
  getAllDiscountAdminController,
  updateAllDiscountAdminController,
  getMerchantDiscountByIdController,
} = require("../../../controllers/admin/merchant/discount/merchantDiscountController");

const merchantDiscountRoute = express.Router();
//For Merchant

merchantDiscountRoute.post(
  "/add-merchant-discount",
  [
    body("discountName").notEmpty().withMessage("Discount Name is required"),
    body("maxCheckoutValue")
      .notEmpty()
      .withMessage("Max checkout value is required"),
    body("geofenceId").notEmpty().withMessage("Geofence is required"),
    body("discountType").notEmpty().withMessage("Discount Type is required"),
    body("discountValue").notEmpty().withMessage("Discount value is required"),
    body("description").notEmpty().withMessage("Description is required"),
    body("validFrom").notEmpty().withMessage("Valid from is required"),
    body("validTo").notEmpty().withMessage("Valid to is required"),
  ],
  isAuthenticated,
  addDiscountController
);

merchantDiscountRoute.put(
  "/edit-merchant-discount/:id",
  isAuthenticated,
  editDiscountController
);

merchantDiscountRoute.get(
  "/get-merchant-discount",
  isAuthenticated,
  getAllDiscountController
);

merchantDiscountRoute.delete(
  "/delete-merchant-discount/:id",
  isAuthenticated,
  deleteDiscountController
);

merchantDiscountRoute.put(
  "/merchant-status/:id",
  isAuthenticated,
  updateDiscountStatusController
);

merchantDiscountRoute.put(
  "/update-all-status",
  isAuthenticated,
  updateAllDiscountController
);

merchantDiscountRoute.get(
  "/get-merchant-discount-id/:id",
  isAuthenticated,
  getMerchantDiscountByIdController
);

//For Admin

merchantDiscountRoute.post(
  "/add-merchant-discount-admin",
  [
    body("discountName").notEmpty().withMessage("Discount Name is required"),
    body("maxCheckoutValue")
      .notEmpty()
      .withMessage("Max checkout value is required"),
    body("geofenceId").notEmpty().withMessage("Geofence is required"),
    body("discountType").notEmpty().withMessage("Discount Type is required"),
    body("discountValue").notEmpty().withMessage("Discount value is required"),
    body("description").notEmpty().withMessage("Description is required"),
    body("validFrom").notEmpty().withMessage("Valid from is required"),
    body("validTo").notEmpty().withMessage("Valid to is required"),
    body("merchantId").notEmpty().withMessage("Merchant id is required"),
  ],
  isAuthenticated,
  isAdmin,
  addDiscountAdminController
);

merchantDiscountRoute.put(
  "/edit-merchant-discount-admin/:id",
  isAuthenticated,
  isAdmin,
  editDiscountController
);

merchantDiscountRoute.delete(
  "/delete-merchant-discount-admin/:id",
  isAuthenticated,
  isAdmin,
  deleteDiscountController
);

merchantDiscountRoute.get(
  "/get-merchant-discount-admin/:id",
  isAuthenticated,
  isAdmin,
  getAllDiscountAdminController
);

merchantDiscountRoute.put(
  "/merchant-status-admin/:id",
  isAuthenticated,
  isAdmin,
  updateDiscountStatusController
);

merchantDiscountRoute.put(
  "/edit-merchant-status-admin/:id",
  isAuthenticated,
  isAdmin,
  updateAllDiscountAdminController
);

module.exports = merchantDiscountRoute;
