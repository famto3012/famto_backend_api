const express = require("express");
const { body } = require("express-validator");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const { upload } = require("../../../utils/imageOperation");
const { addAppBannerController, editAppBannerController, getAllAppBannersController, deleteAppBannerController, updateStatusAppBannerController, getAppBannerByIdController } = require("../../../controllers/admin/banner/appBannerController");

const appBannerRoute = express.Router();

appBannerRoute.post(
  "/add-app-banner",
  upload.single("appBannerImage"),
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("merchantId").notEmpty().withMessage("Merchant Id is required"),
    body("geofenceId").notEmpty().withMessage("Geofence is required"),
  ],
  isAuthenticated,
  isAdmin,
  addAppBannerController
);

appBannerRoute.put(
  "/edit-app-banner/:id",
  upload.single("bannerImage"),
  isAuthenticated,
  isAdmin,
  editAppBannerController
);

appBannerRoute.get(
  "/get-app-banner",
  isAuthenticated,
  isAdmin,
  getAllAppBannersController
);

appBannerRoute.get(
  "/get-app-banner/:id",
  isAuthenticated,
  isAdmin,
  getAppBannerByIdController
);

appBannerRoute.delete(
  "/delete-app-banner/:id",
  isAuthenticated,
  isAdmin,
  deleteAppBannerController
);

appBannerRoute.put(
  "/app-banner-status/:id",
  isAuthenticated,
  isAdmin,
  updateStatusAppBannerController
);

module.exports = appBannerRoute;
