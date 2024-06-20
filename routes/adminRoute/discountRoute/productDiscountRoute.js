const express = require("express");
const { body } = require("express-validator");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");

const productDiscountRoute = express.Router();

productDiscountRoute.post(
  "/add-banner",
  upload.single("bannerImage"),
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("merchantId").notEmpty().withMessage("Merchant Id is required"),
    body("geofenceId").notEmpty().withMessage("Geofence is required"),
  ],
  isAuthenticated,
  isAdmin,
  addBannerController
);

productDiscountRoute.put(
  "/edit-banner/:id",
  upload.single("bannerImage"),
  isAuthenticated,
  isAdmin,
  editBannerController
);

productDiscountRoute.get(
  "/get-banner",
  isAuthenticated,
  isAdmin,
  getAllBannersController
);

productDiscountRoute.delete(
  "/delete-banner/:id",
  isAuthenticated,
  isAdmin,
  deleteBannerController
);

productDiscountRoute.put(
  "/banner-status/:id",
  isAuthenticated,
  isAdmin,
  updateStatusBannerController
);

module.exports = productDiscountRoute;
