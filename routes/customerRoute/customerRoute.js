const express = require("express");
const {
  registerAndLoginController,
  loginController,
  getCustomerProfileController,
  updateCustomerProfileController,
  updateCustomerAddressController,
} = require("../../controllers/customer/customerController");
const isAuthenticated = require("../../middlewares/isAuthenticated");
const { body } = require("express-validator");
const { upload } = require("../../utils/imageOperation");

const customerRoute = express.Router();

customerRoute.post(
  "/authenticate",
  [
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
  ],
  registerAndLoginController
);

customerRoute.get("/profile", isAuthenticated, getCustomerProfileController);

customerRoute.put(
  "/edit-profile",
  upload.single("customerImage"),
  isAuthenticated,
  updateCustomerProfileController
);

customerRoute.patch(
  "/update-address",
  [
    body("addresses").isArray().withMessage("Addresses should be an array"),
    body("addresses.*.type")
      .notEmpty()
      .withMessage("Address type is required")
      .isIn(["home", "work", "other"])
      .withMessage("Invalid address type"),
    body("addresses.*.fullName")
      .notEmpty()
      .withMessage("Full name is required"),
    body("addresses.*.phoneNumber")
      .notEmpty()
      .withMessage("Phone number is required"),
    body("addresses.*.flat").notEmpty().withMessage("Flat is required"),
    body("addresses.*.area").notEmpty().withMessage("Area is required"),
    body("addresses.*.landmark").optional(),
  ],
  isAuthenticated,
  updateCustomerAddressController
);

module.exports = customerRoute;
