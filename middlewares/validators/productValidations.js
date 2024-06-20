const { body, check } = require("express-validator");

const addProductValidations = [
  body("productName").trim().notEmpty().withMessage("Product name is required"),
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
  body("description").trim().notEmpty().withMessage("Description is required"),
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
];

const editProductValidations = [
  body("productName").trim().notEmpty().withMessage("Product name is required"),
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
  body("description").trim().notEmpty().withMessage("Description is required"),
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
];

module.exports = { addProductValidations, editProductValidations };
