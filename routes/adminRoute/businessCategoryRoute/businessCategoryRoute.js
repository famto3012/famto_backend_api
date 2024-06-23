const express = require("express");
const { upload } = require("../../../utils/imageOperation");
const {
  addBusinessCategoryController,
  getAllBusinessCategoryController,
  getSingleBusinessCategoryController,
  editBusinessCategoryController,
  deleteBusinessCategoryController,
  enableOrDisableBusinessCategoryController,
  updateBusinessCategoryOrderController,
} = require("../../../controllers/admin/businessCategory/businessCategoryController");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const businessCategoryRoute = express.Router();

businessCategoryRoute.post(
  "/add-business-category",
  upload.single("bannerImage"),
  isAuthenticated,
  isAdmin,
  addBusinessCategoryController
);

businessCategoryRoute.get(
  "/get-all-business-category",
  isAuthenticated,
  isAdmin,
  getAllBusinessCategoryController
);

businessCategoryRoute.get(
  "/:businessCategoryId",
  isAuthenticated,
  isAdmin,
  getSingleBusinessCategoryController
);

businessCategoryRoute.put(
  "/edit-business-category/:businessCategoryId",
  upload.single("bannerImage"),
  isAuthenticated,
  isAdmin,
  editBusinessCategoryController
);

businessCategoryRoute.delete(
  "/delete-business-category/:businessCategoryId",
  isAuthenticated,
  isAdmin,
  deleteBusinessCategoryController
);

businessCategoryRoute.post(
  "/change-status/:businessCategoryId",
  isAuthenticated,
  isAdmin,
  enableOrDisableBusinessCategoryController
);

businessCategoryRoute.put(
  "/edit-business-category-order",
  isAuthenticated,
  isAdmin,
  updateBusinessCategoryOrderController
);

module.exports = businessCategoryRoute;
