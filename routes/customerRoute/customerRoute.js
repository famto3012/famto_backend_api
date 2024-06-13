const express = require("express");
const {
    registerAndLoginController,
  loginController,
} = require("../../controllers/customer/customerController");
const isAuthenticated = require("../../middlewares/isAuthenticated");
const { body } = require("express-validator");

const router = express.Router();

router.post("/register", [
    body()
      .custom((value, { req }) => {
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
  ], registerAndLoginController);

// router.post("/sign-in", [
//     body("email")
//     .trim()
//     .notEmpty()
//     .isEmail()
//     .withMessage("Email is required"),
//     body("password")
//       .trim()
//       .notEmpty()
//       .withMessage("Password is required"),
//   ], loginController);
  

module.exports = router;

