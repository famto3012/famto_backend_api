const express = require("express");
const {
  addProductController,
  updateProductDetailsController,
  editProductController,
  deleteProductController,
  deleteProductDetailsController,
  getProductController,
  searchProductController,
  getProductByCategory,
} = require("../../../../controllers/admin/merchant/product/productController");
const { body, check } = require("express-validator");
const { upload } = require("../../../../utils/imageOperation");
const {
  addProductValidations,
  editProductValidations,
} = require("../../../../middlewares/validators/productValidations");
const isAuthenticated = require("../../../../middlewares/isAuthenticated");

const productRoute = express.Router();

//Search Product Details
productRoute.get("/search", isAuthenticated, searchProductController);

//Get Product
productRoute.get("/:productId", isAuthenticated, getProductController);

//Add Product
productRoute.post(
  "/add-product",
  upload.single("productImage"),
  addProductValidations,
  isAuthenticated,
  addProductController
);

//Edit Product
productRoute.put(
  "/edit-product/:productId",
  upload.single("productImage"),
  editProductValidations,
  isAuthenticated,
  editProductController
);

//Edit Product
productRoute.delete(
  "/delete-product/:productId",
  isAuthenticated,
  deleteProductController
);

//Add Product Details
productRoute.put(
  "/:productId/add-product-details",
  [
    body("productName").trim().optional(),
    body("price").trim().optional(),
    body("description").trim().optional(),
    body("availableQuantity").trim().optional(),
    body("inventory").trim().optional(),
    body("alert").optional(),
    body("variants")
      .optional()
      .isArray()
      .withMessage("Variants should be an array"),
  ],
  isAuthenticated,
  updateProductDetailsController
);

//Edit Product Details
productRoute.put(
  "/:productId/edit-product-details",
  [
    body("productName").trim().optional(),
    body("price").trim().optional(),
    body("description").trim().optional(),
    body("availableQuantity").trim().optional(),
    body("inventory").trim().optional(),
    body("alert").optional(),
    body("variants")
      .optional()
      .isArray()
      .withMessage("Variants should be an array"),
  ],
  isAuthenticated,
  updateProductDetailsController
);

//Delete Product Details
productRoute.delete(
  "/:productId/delete-product-details",
  isAuthenticated,
  deleteProductDetailsController
);

//Get Product by category
productRoute.get(
  "/product-by-category/:categoryId",
  isAuthenticated,
  getProductByCategory
);

module.exports = productRoute;
