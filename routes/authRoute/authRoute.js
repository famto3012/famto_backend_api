const express = require("express");
const {
  registerController,
  loginController,
  blockMerchant,
} = require("../../controllers/admin/authController");
const isAuthenticated = require("../../middlewares/isAuthenticated");
const isAdmin = require("../../middlewares/isAdmin");

const router = express.Router();

router.post("/register", registerController);
router.post("/sign-in", loginController);
router.put(
  "/block-merchant/:merchantId",
  isAuthenticated,
  isAdmin,
  blockMerchant
);

module.exports = router;
