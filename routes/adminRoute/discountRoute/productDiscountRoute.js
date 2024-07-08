const express = require("express");
const { body } = require("express-validator");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const {
  addProductDiscountController,
  editProductDiscountController,
  deleteProductDiscountController,
  getAllProductDiscountController,
  updateProductDiscountStatusController,
  addProductDiscountAdminController,
  getProductDiscountByIdController,
} = require("../../../controllers/admin/merchant/discount/productDiscountController");
const {
  getAllDiscountAdminController,
} = require("../../../controllers/admin/merchant/discount/merchantDiscountController");

const productDiscountRoute = express.Router();
//For Merchant

productDiscountRoute.post(
  "/add-product-discount",
  [
    body("discountName").notEmpty().withMessage("Discount Name is required"),
    body("maxAmount").notEmpty().withMessage("Max amount is required"),
    body("geofenceId").notEmpty().withMessage("Geofence is required"),
    body("discountType").notEmpty().withMessage("Discount Type is required"),
    body("discountValue").notEmpty().withMessage("Discount value is required"),
    body("description").notEmpty().withMessage("Description is required"),
    body("validFrom").notEmpty().withMessage("Valid from is required"),
    body("validTo").notEmpty().withMessage("Valid to is required"),
    body("productId").notEmpty().withMessage("Product id is required"),
    body("onAddOn").notEmpty().withMessage("On add on is required"),
  ],
  isAuthenticated,
  addProductDiscountController
);

productDiscountRoute.put(
  "/edit-product-discount/:id",
  isAuthenticated,
  editProductDiscountController
);

productDiscountRoute.get(
  "/get-product-discount",
  isAuthenticated,
  getAllProductDiscountController
);

productDiscountRoute.delete(
  "/delete-product-discount/:id",
  isAuthenticated,
  deleteProductDiscountController
);

productDiscountRoute.put(
  "/product-status/:id",
  isAuthenticated,
  updateProductDiscountStatusController
);

productDiscountRoute.get(
  "/get-product-discount-id/:id",
  isAuthenticated,
  getProductDiscountByIdController
);

//For Admin

productDiscountRoute.post(
  "/add-product-discount-admin",
  [
    body("discountName").notEmpty().withMessage("Discount Name is required"),
    body("maxAmount").notEmpty().withMessage("Max amount is required"),
    body("geofenceId").notEmpty().withMessage("Geofence is required"),
    body("discountType").notEmpty().withMessage("Discount Type is required"),
    body("discountValue").notEmpty().withMessage("Discount value is required"),
    body("description").notEmpty().withMessage("Description is required"),
    body("validFrom").notEmpty().withMessage("Valid from is required"),
    body("validTo").notEmpty().withMessage("Valid to is required"),
    body("productId").notEmpty().withMessage("Product id is required"),
    body("merchantId").notEmpty().withMessage("Merchant id is required"),
    body("onAddOn").notEmpty().withMessage("On add on is required"),
  ],
  isAuthenticated,
  isAdmin,
  addProductDiscountAdminController
);

productDiscountRoute.put(
  "/edit-product-discount-admin/:id",
  isAuthenticated,
  isAdmin,
  editProductDiscountController
);

productDiscountRoute.delete(
  "/delete-product-discount-admin/:id",
  isAuthenticated,
  isAdmin,
  deleteProductDiscountController
);

productDiscountRoute.get(
  "/get-product-discount-admin/:id",
  isAuthenticated,
  isAdmin,
  getAllDiscountAdminController
);

productDiscountRoute.put(
  "/product-status-admin/:id",
  isAuthenticated,
  isAdmin,
  updateProductDiscountStatusController
);

module.exports = productDiscountRoute;
