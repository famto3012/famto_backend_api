const { body } = require("express-validator");

const addCategoryByAdminValidation = [
  body("businessCategoryId")
    .trim()
    .notEmpty()
    .withMessage("Business Category is required"),
  body("merchantId").trim().notEmpty().withMessage("Merchant is required"),
  body("categoryName")
    .trim()
    .notEmpty()
    .withMessage("Category name is required"),
  body("description").optional().trim(),
  body("type").trim().notEmpty().withMessage("Type is required"),
];

const editCategoryByAdminValidation = [
  body("businessCategoryId")
    .trim()
    .notEmpty()
    .withMessage("Business Category is required"),
  body("categoryName")
    .trim()
    .notEmpty()
    .withMessage("Category name is required"),
  body("description").optional().trim(),
  body("type").trim().notEmpty().withMessage("Type is required"),
];

const addCategoryByMerchantValidation = [
  body("businessCategoryId")
    .trim()
    .notEmpty()
    .withMessage("Business Category is required"),
  body("categoryName")
    .trim()
    .notEmpty()
    .withMessage("Category name is required"),
  body("description").optional().trim(),
  body("type").trim().notEmpty().withMessage("Type is required"),
];

const editCategoryByMerchantValidation = [
  body("businessCategoryId")
    .trim()
    .notEmpty()
    .withMessage("Business Category is required"),
  body("categoryName")
    .trim()
    .notEmpty()
    .withMessage("Category name is required"),
  body("description").optional().trim(),
  body("type").trim().notEmpty().withMessage("Type is required"),
];

module.exports = {
  addCategoryByAdminValidation,
  editCategoryByAdminValidation,
  addCategoryByMerchantValidation,
  editCategoryByMerchantValidation,
};
