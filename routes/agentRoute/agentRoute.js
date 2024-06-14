const express = require("express");
const {
  registerAgentController,
} = require("../../controllers/agent/agentController");
const { body } = require("express-validator");
const { upload } = require("../../utils/imageOperation");

const agentRoute = express.Router();

agentRoute.post(
  "/register",
  upload.single("agentImage"),
  [
    body("fullName").trim().notEmpty().withMessage("Full name is required"),
    body("email").trim().isEmail().withMessage("Valid email is required"),
    body("phoneNumber")
      .trim()
      .notEmpty()
      .withMessage("Phone number is required"),
    body("location").isArray().withMessage("Location must be an array"),
    body("location").custom((value) => {
      if (value.length !== 2) {
        throw new Error(
          "Location must have exactly two elements [latitude, longitude]"
        );
      }
      return true;
    }),
  ],
  registerAgentController
);

module.exports = agentRoute;
