const express = require("express");
const {
  registerController,
  loginController,
  blockMerchant,
} = require("../../controllers/admin/authController");
const isAuthenticated = require("../../middlewares/isAuthenticated");
const isAdmin = require("../../middlewares/isAdmin");

const authRoute = express.Router();

authRoute.post("/register", registerController);
authRoute.post("/sign-in", loginController);
authRoute.put(
  "/block-merchant/:merchantId",
  isAuthenticated,
  isAdmin,
  blockMerchant
);

module.exports = authRoute;
