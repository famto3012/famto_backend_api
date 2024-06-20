const express = require("express");
const { upload } = require("../../../utils/imageOperation");
const {
  addBusinessCategoryController,
  getAllBusinessCategoryController,
  getSingleBusinessCategoryController,
  editBusinessCategoryController,
  deleteBusinessCategoryController,
  enableOrDisableBusinessCategoryController,
} = require("../../../controllers/admin/businessCategory/businessCategoryController");
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

module.exports = businessCategoryRoute;
