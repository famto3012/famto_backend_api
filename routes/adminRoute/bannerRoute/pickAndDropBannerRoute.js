const express = require("express");
const { body } = require("express-validator");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const { upload } = require("../../../utils/imageOperation");
const {
  addPickAndDropBannerController,
  editPickAndDropBannerController,
  getAllPickAndDropBannersController,
  getPickAndDropBannerByIdController,
  deletePickAndDropBannerController,
  updateStatusPickAndDropBannerController,
} = require("../../../controllers/admin/banner/pickAndDropBannerController");

const pickAndDropBannerRoute = express.Router();

pickAndDropBannerRoute.post(
  "/add-pick-drop-banner",
  upload.single("bannerImage"),
  [
    body("title").notEmpty().withMessage("Title is required"),
    body("description").notEmpty().withMessage("Description is required"),
  ],
  isAuthenticated,
  isAdmin,
  addPickAndDropBannerController
);

pickAndDropBannerRoute.put(
  "/edit-pick-drop-banner/:id",
  upload.single("bannerImage"),
  isAuthenticated,
  isAdmin,
  editPickAndDropBannerController
);

pickAndDropBannerRoute.get(
  "/get-pick-drop-banner",
  isAuthenticated,
  isAdmin,
  getAllPickAndDropBannersController
);

pickAndDropBannerRoute.get(
  "/get-pick-drop-banner/:id",
  isAuthenticated,
  isAdmin,
  getPickAndDropBannerByIdController
);

pickAndDropBannerRoute.delete(
  "/delete-pick-drop-banner/:id",
  isAuthenticated,
  isAdmin,
  deletePickAndDropBannerController
);

pickAndDropBannerRoute.put(
  "/pick-drop-banner-status",
  isAuthenticated,
  isAdmin,
  updateStatusPickAndDropBannerController
);

module.exports = pickAndDropBannerRoute;
