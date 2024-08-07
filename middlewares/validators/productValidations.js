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
  body("discountId").optional().isMongoId().withMessage("Invalid Discount ID"),
  body("oftenBoughtTogetherId")
    .optional()
    .isMongoId()
    .withMessage("Invalid ID"),
  body("preparationTime")
    .trim()
    .notEmpty()
    .withMessage("Preparation time is required")
    .isNumeric()
    .withMessage("Preparation time must be a number"),
  // body("searchTags")
  //   .isArray({ min: 1 })
  //   .withMessage("Search tags must be an array with at least one tag")
  //   .custom((tags) => tags.every((tag) => typeof tag === "string"))
  //   .withMessage("Each search tag must be a string"),
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
  body("discountId").optional().trim(),
  body("oftenBoughtTogetherId").optional().trim(),
  body("preparationTime")
    .trim()
    .notEmpty()
    .withMessage("Preperation time is required")
    .isNumeric()
    .withMessage("Preperation time must be a number"),
  // body("searchTags")
  //   .isArray({ min: 1 })
  //   .withMessage("Search tags must be an array with at least one tag")
  //   .custom((tags) => tags.every((tag) => typeof tag === "string"))
  //   .withMessage("Each search tag must be a string"),
  body("description").trim().notEmpty().withMessage("Description is required"),
  body("longDescription")
    .trim()
    .notEmpty()
    .withMessage("Long description is required"),
  body("type").trim().notEmpty().withMessage("Type is required"),
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
