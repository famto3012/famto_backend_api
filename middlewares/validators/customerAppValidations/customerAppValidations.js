const { body, check } = require("express-validator");

const customerAuthenticateValidations = [
  body().custom((value, { req }) => {
    const email = req.body.email;
    const phoneNumber = req.body.phoneNumber;
    if (!email && !phoneNumber) {
      throw new Error("Either email or phone number must be provided");
    }
    if (email && phoneNumber) {
      throw new Error("Only one of email or phone number should be provided");
    }
    return true;
  }),
  body("email")
    .if((value, { req }) => req.body.email) // Only run this validator if email is provided
    .trim()
    .isEmail()
    .withMessage("Invalid email format"),
  body("phoneNumber")
    .if((value, { req }) => req.body.phoneNumber) // Only run this validator if phone number is provided
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage("Invalid phone number format"),
];

const updateAddressValidations = [
  body("addresses").isArray().withMessage("Addresses should be an array"),
  body("addresses.*.type")
    .notEmpty()
    .withMessage("Address type is required")
    .isIn(["home", "work", "other"])
    .withMessage("Invalid address type"),
  body("addresses.*.fullName").notEmpty().withMessage("Full name is required"),
  body("addresses.*.phoneNumber")
    .notEmpty()
    .withMessage("Phone number is required"),
  body("addresses.*.flat").notEmpty().withMessage("Flat is required"),
  body("addresses.*.area").notEmpty().withMessage("Area is required"),
  body("addresses.*.landmark").optional(),
];

module.exports = { customerAuthenticateValidations, updateAddressValidations };