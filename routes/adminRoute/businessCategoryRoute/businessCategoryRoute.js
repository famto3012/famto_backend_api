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
  addBusinessCategoryController
);

businessCategoryRoute.get(
  "/get-all-business-category",
  getAllBusinessCategoryController
);

businessCategoryRoute.get(
  "/:businessCategoryId",
  getSingleBusinessCategoryController
);

businessCategoryRoute.put(
  "/edit-business-category/:businessCategoryId",
  upload.single("bannerImage"),
  editBusinessCategoryController
);

businessCategoryRoute.delete(
  "/delete-business-category/:businessCategoryId",
  deleteBusinessCategoryController
);

businessCategoryRoute.post(
  "/change-status/:businessCategoryId",
  enableOrDisableBusinessCategoryController
);

businessCategoryRoute.put(
  "/edit-business-category-order",
  isAuthenticated,
  isAdmin,
  updateBusinessCategoryOrderController
);

module.exports = businessCategoryRoute;
