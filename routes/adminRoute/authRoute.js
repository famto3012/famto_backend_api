const express = require("express");
const { body } = require("express-validator");
const { loginController } = require("../../controllers/admin/authController");

const authRoute = express.Router();

// authRoute.post(
//   "/register",
//   [
//     body("fullName").trim().notEmpty().withMessage("Full Name is required"),
//     body("email").trim().notEmpty().withMessage("Email is required"),
//     body("phoneNumber")
//       .trim()
//       .notEmpty()
//       .withMessage("Phone number is required"),
//     body("password")
//       .trim()
//       .notEmpty()
//       .withMessage("Password is required")
//       .isLength({ min: 6 })
//       .withMessage("Password should have minimum of 6 characters"),
//     body("confirmPassword")
//       .trim()
//       .notEmpty()
//       .withMessage("Confirmation password is required")
//       .custom((value, { req }) => {
//         if (req.body.password !== value) {
//           throw new Error("Passwords do not match");
//         }

//         return true;
//       }),
//   ],
//   registerController
// );

authRoute.post(
  "/sign-in",
  [
    body("email").trim().notEmpty().withMessage("Email is required"),
    body("password").trim().notEmpty().withMessage("Password is required"),
    body("role").trim().notEmpty().withMessage("Role is required"),
  ],
  loginController
);

module.exports = authRoute;
