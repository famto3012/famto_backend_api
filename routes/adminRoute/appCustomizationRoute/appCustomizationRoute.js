const express = require("express");
const { upload } = require("../../../utils/imageOperation");
const { createOrUpdateAgentCustomizationController } = require("../../../controllers/admin/appCustomization/agentAppCustomizationController");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const { createOrUpdateMerchantCustomizationController } = require("../../../controllers/admin/appCustomization/merchantAppCustomizationController");

const appCustomizationRoute = express.Router();

appCustomizationRoute.post(
  "/agent-app",
  upload.single("splashScreenImage"),
  isAuthenticated,
  isAdmin,
  createOrUpdateAgentCustomizationController
);

appCustomizationRoute.post(
  "/merchant-app", 
  upload.single("splashScreenImage"),
  isAuthenticated,
  isAdmin,
  createOrUpdateMerchantCustomizationController
);

module.exports = appCustomizationRoute;
