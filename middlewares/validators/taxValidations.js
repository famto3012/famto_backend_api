const { body } = require("express-validator");

const taxValidations = [
  body("taxName").trim().notEmpty().withMessage("Tax name is required"),
];

module.exports = { taxValidations };
