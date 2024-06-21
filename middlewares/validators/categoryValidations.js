const { body, check } = require("express-validator");

const addCategoryValidation = [
  body("businessCategoryId")
    .trim()
    .notEmpty()
    .withMessage("Business Category is required"),
  body("merchantId").trim().notEmpty().withMessage("Merchant is required"),
  body("categoryName")
    .trim()
    .notEmpty()
    .withMessage("Category name is required"),
  body("description").trim().notEmpty().withMessage("Description is required"),
  body("type").trim().notEmpty().withMessage("Type is required"),
  check("categoryImage").custom((value, { req }) => {
    if (!req.file) {
      throw new Error("Merchant image is required");
    }
    return true;
  }),
];

const editCategoryValidation = [
  body("businessCategoryId")
    .trim()
    .notEmpty()
    .withMessage("Business Category is required"),
  body("merchantId").trim().notEmpty().withMessage("Merchant is required"),
  body("categoryName")
    .trim()
    .notEmpty()
    .withMessage("Category name is required"),
  body("description").trim().notEmpty().withMessage("Description is required"),
  body("type").trim().notEmpty().withMessage("Type is required"),
  check("categoryImage").custom((value, { req }) => {
    if (!req.body.categoryImageURL && !req.file) {
      throw new Error("Category image is required");
    }
    return true;
  }),
];

module.exports = { addCategoryValidation, editCategoryValidation };
