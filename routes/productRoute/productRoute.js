const express = require("express");
const {
  addProductController,
  updateProductDetailsController,
  editProductController,
  deleteProductController,
  deleteProductDetailsController,
  getProductController,
  searchProductController,
} = require("../../controllers/product/productController");
const { body, check } = require("express-validator");
const { upload } = require("../../utils/imageOperation");
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
  [
    body("productName")
      .trim()
      .notEmpty()
      .withMessage("Product name is required"),
    body("price").trim().notEmpty().withMessage("Price is required"),
    body("minQuantityToOrder")
      .trim()
      .notEmpty()
      .withMessage("Min quantity is required"),
    body("maxQuantityPerOrder")
      .trim()
      .notEmpty()
      .withMessage("Max quantity is required"),
    body("costPrice").trim().notEmpty().withMessage("Cost price is required"),
    body("sku").trim().notEmpty().withMessage("SKU is required"),
    body("discountId").trim().notEmpty().withMessage("Discount is required"),
    body("oftenBoughtTogether")
      .trim()
      .notEmpty()
      .withMessage("Often Bought Together is required"),
    body("preperationTime")
      .trim()
      .notEmpty()
      .withMessage("Preperation time is required"),
    body("searchTags")
      .isArray({ min: 1 })
      .withMessage("Search tags must be an array with at least one tag")
      .custom((tags) => tags.every((tag) => typeof tag === "string"))
      .withMessage("Each search tag must be a string"),
    body("description")
      .trim()
      .notEmpty()
      .withMessage("Description is required"),
    body("longDescription")
      .trim()
      .notEmpty()
      .withMessage("Long description is required"),
    body("type").trim().notEmpty().withMessage("Type is required"),
    check("productImage").custom((value, { req }) => {
      if (!req.file) {
        throw new Error("Product image is required");
      }
      return true;
    }),
  ],
  addProductController
);

//TODO: Need to add authorization
//Edit Product
productRoute.put(
  "/edit-product/:productId",
  upload.single("productImage"),
  [
    body("productName")
      .trim()
      .notEmpty()
      .withMessage("Product name is required"),
    body("price").trim().notEmpty().withMessage("Price is required"),
    body("minQuantityToOrder")
      .trim()
      .notEmpty()
      .withMessage("Min quantity is required"),
    body("maxQuantityPerOrder")
      .trim()
      .notEmpty()
      .withMessage("Max quantity is required"),
    body("costPrice").trim().notEmpty().withMessage("Cost price is required"),
    body("sku").trim().notEmpty().withMessage("SKU is required"),
    body("discountId").trim().notEmpty().withMessage("Discount is required"),
    body("oftenBoughtTogether")
      .trim()
      .notEmpty()
      .withMessage("Often Bought Together is required"),
    body("preperationTime")
      .trim()
      .notEmpty()
      .withMessage("Preperation time is required"),
    body("searchTags")
      .isArray({ min: 1 })
      .withMessage("Search tags must be an array with at least one tag")
      .custom((tags) => tags.every((tag) => typeof tag === "string"))
      .withMessage("Each search tag must be a string"),
    body("description")
      .trim()
      .notEmpty()
      .withMessage("Description is required"),
    body("longDescription")
      .trim()
      .notEmpty()
      .withMessage("Long description is required"),
    body("type").trim().notEmpty().withMessage("Type is required"),
    check("productImage").custom((value, { req }) => {
      if (!req.file && !req.body.productImageURL) {
        throw new Error("Product image is required");
      }
      return true;
    }),
  ],
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

module.exports = productRoute;
