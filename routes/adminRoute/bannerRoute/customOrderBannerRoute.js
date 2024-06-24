const express = require("express");
const { body } = require("express-validator");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const { upload } = require("../../../utils/imageOperation");
const {
  addCustomOrderBannerController,
  editCustomOrderBannerController,
  getAllCustomOrderBannersController,
  getCustomOrderBannerByIdController,
  deleteCustomOrderBannerController,
  updateStatusCustomOrderBannerController,
} = require("../../../controllers/admin/banner/customOrderBannerController");

const customOrderBannerRoute = express.Router();

customOrderBannerRoute.post(
  "/add-custom-order-banner",
  upload.single("bannerImage"),
  [
    body("title").notEmpty().withMessage("Title is required"),
    body("description").notEmpty().withMessage("Description is required"),
  ],
  isAuthenticated,
  isAdmin,
  addCustomOrderBannerController
);

customOrderBannerRoute.put(
  "/edit-custom-order-banner/:id",
  upload.single("bannerImage"),
  isAuthenticated,
  isAdmin,
  editCustomOrderBannerController
);

customOrderBannerRoute.get(
  "/get-custom-order-banner",
  isAuthenticated,
  isAdmin,
  getAllCustomOrderBannersController
);

customOrderBannerRoute.get(
  "/get-custom-order-banner/:id",
  isAuthenticated,
  isAdmin,
  getCustomOrderBannerByIdController
);

customOrderBannerRoute.delete(
  "/delete-custom-order-banner/:id",
  isAuthenticated,
  isAdmin,
  deleteCustomOrderBannerController
);

customOrderBannerRoute.put(
  "/custom-order-banner-status",
  isAuthenticated,
  isAdmin,
  updateStatusCustomOrderBannerController
);

module.exports = customOrderBannerRoute;
