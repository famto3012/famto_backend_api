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

const productRoute = express.Router();

//TODO: Need to add authorization
//Search Product Details
productRoute.get("/search", searchProductController);

//TODO: Need to add authorization
//Get Product
productRoute.get("/:productId", getProductController);

//TODO: Need to add authorization
//Add Product
productRoute.post(
  "/add-product",
  upload.single("productImage"),
  addProductValidations,
  addProductController
);

//TODO: Need to add authorization
//Edit Product
productRoute.put(
  "/edit-product/:productId",
  upload.single("productImage"),
  editProductValidations,
  editProductController
);

//TODO: Need to add authorization
//Edit Product
productRoute.delete("/delete-product/:productId", deleteProductController);

//TODO: Need to add authorization
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
  updateProductDetailsController
);

//TODO: Need to add authorization
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
  updateProductDetailsController
);

//TODO: Need to add authorization
//Delete Product Details
productRoute.delete(
  "/:productId/delete-product-details",
  deleteProductDetailsController
);

//TODO: Need to add authorization
//Get Product by category
productRoute.get("/product-by-category/:categoryId", getProductByCategory);

module.exports = productRoute;
