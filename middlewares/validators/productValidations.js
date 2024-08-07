const { body, check } = require("express-validator");

const addProductValidations = [
  body("categoryId").trim().notEmpty().withMessage("Category Id is required"),
  body("productName").trim().notEmpty().withMessage("Product name is required"),
  body("price")
    .trim()
    .notEmpty()
    .withMessage("Price is required")
    .isNumeric()
    .withMessage("Price must be a number"),
  body("minQuantityToOrder")
    .trim()
    .notEmpty()
    .withMessage("Min quantity is required")
    .isNumeric()
    .withMessage("Min quantity must be a number"),
  body("maxQuantityPerOrder")
    .trim()
    .notEmpty()
    .withMessage("Max quantity is required")
    .isNumeric()
    .withMessage("Max quantity must be a number"),
  body("costPrice")
    .trim()
    .notEmpty()
    .withMessage("Cost price is required")
    .isNumeric()
    .withMessage("Cost price must be a number"),
  body("sku").trim().notEmpty().withMessage("SKU is required"),
  body("discountId").optional(),
  body("oftenBoughtTogetherId")
    .optional()
    .custom((value, { req }) => {
      if (!Array.isArray(value)) {
        throw new Error("Often Bought Together must be an array");
      }
      if (!value.every((item) => typeof item === "string")) {
        throw new Error("Each item in Often Bought Together must be a string");
      }
      return true;
    }),
  body("preparationTime")
    .trim()
    .notEmpty()
    .withMessage("Preparation time is required")
    .isNumeric()
    .withMessage("Preparation time must be a number"),
  body("searchTags").custom((tags) => {
    if (!Array.isArray(tags)) {
      throw new Error("Search tags must be an array");
    }
    if (!tags.every((tag) => typeof tag === "string")) {
      throw new Error("Each search tag must be a string");
    }
    return true;
  }),
  body("description").trim().notEmpty().withMessage("Description is required"),
  body("longDescription")
    .trim()
    .notEmpty()
    .withMessage("Long description is required"),
  body("type")
    .trim()
    .notEmpty()
    .withMessage("Type is required")
    .isIn(["Veg", "Non-veg"])
    .withMessage("Type must be either 'Veg' or 'Non-veg'"),
  body("availableQuantity")
    .trim()
    .notEmpty()
    .withMessage("Available quantity is required")
    .isNumeric()
    .withMessage("Available quantity must be a number"),
  body("alert")
    .trim()
    .notEmpty()
    .withMessage("Alert is required")
    .isNumeric()
    .withMessage("Alert must be a number"),
  check("productImage").custom((value, { req }) => {
    if (!req.file) {
      throw new Error("Product image is required");
    }
    return true;
  }),
];

const editProductValidations = [
  body("categoryId").trim().notEmpty().withMessage("Category Id is required"),
  body("productName").trim().notEmpty().withMessage("Product name is required"),
  body("price")
    .trim()
    .notEmpty()
    .withMessage("Price is required")
    .isNumeric()
    .withMessage("Price must be a number"),
  body("minQuantityToOrder")
    .trim()
    .notEmpty()
    .withMessage("Min quantity is required")
    .isNumeric()
    .withMessage("Min quantity must be a number"),
  body("maxQuantityPerOrder")
    .trim()
    .notEmpty()
    .withMessage("Max quantity is required")
    .isNumeric()
    .withMessage("Max quantity must be a number"),
  body("costPrice")
    .trim()
    .notEmpty()
    .withMessage("Cost price is required")
    .isNumeric()
    .withMessage("Cost price must be a number"),
  body("sku").trim().notEmpty().withMessage("SKU is required"),
  body("discountId").optional(),
  body("oftenBoughtTogetherId")
    .optional()
    .custom((value, { req }) => {
      if (!Array.isArray(value)) {
        throw new Error("Often Bought Together must be an array");
      }
      if (!value.every((item) => typeof item === "string")) {
        throw new Error("Each item in Often Bought Together must be a string");
      }
      return true;
    }),
  body("preparationTime")
    .trim()
    .notEmpty()
    .withMessage("Preparation time is required")
    .isNumeric()
    .withMessage("Preparation time must be a number"),
  body("searchTags").custom((tags) => {
    if (!Array.isArray(tags)) {
      throw new Error("Search tags must be an array");
    }
    if (!tags.every((tag) => typeof tag === "string")) {
      throw new Error("Each search tag must be a string");
    }
    return true;
  }),
  body("description").trim().notEmpty().withMessage("Description is required"),
  body("longDescription")
    .trim()
    .notEmpty()
    .withMessage("Long description is required"),
  body("type")
    .trim()
    .notEmpty()
    .withMessage("Type is required")
    .isIn(["Veg", "Non-veg"])
    .withMessage("Type must be either 'Veg' or 'Non-veg'"),
  body("availableQuantity")
    .trim()
    .notEmpty()
    .withMessage("Available quantity is required")
    .isNumeric()
    .withMessage("Available quantity must be a number"),
  body("alert")
    .trim()
    .notEmpty()
    .withMessage("Alert is required")
    .isNumeric()
    .withMessage("Alert must be a number"),
  check("productImage").custom((value, { req }) => {
    if (!req.file && !req.body.productImageURL) {
      throw new Error("Product image is required");
    }
    return true;
  }),
];

const productVariantValidations = [
  body("variantName").notEmpty().withMessage("Variant name is required"),
  body("variantTypes")
    .isArray({ min: 1 })
    .withMessage("Variant types must be an array with at least one element"),
  body("variantTypes.*.typeName")
    .notEmpty()
    .withMessage("Variant type name is required"),
  body("variantTypes.*.price")
    .isNumeric()
    .withMessage("Variant type price must be a number"),
];

module.exports = {
  addProductValidations,
  editProductValidations,
  productVariantValidations,
};
