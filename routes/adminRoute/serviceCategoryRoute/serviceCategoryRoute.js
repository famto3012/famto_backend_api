const express = require("express");
const { upload } = require("../../../utils/imageOperation");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const {
  addServiceCategoryController,
  editServiceCategoryController,
  getAllServiceCategoriesController,
  getServiceCategoryByIdController,
  updateBusinessCategoryOrderController,
} = require("../../../controllers/admin/serviceCategory/serviceCategoryController");
const { body } = require("express-validator");

const serviceCategoryRoute = express.Router();

serviceCategoryRoute.post(
  "/add-service",
  upload.single("bannerImage"),
  [
    body("title").notEmpty().withMessage("Title is required"),
    body("geofenceId").notEmpty().withMessage("Geofence id is required"),
  ],
  isAuthenticated,
  isAdmin,
  addServiceCategoryController
);

serviceCategoryRoute.put(
  "/edit-service/:id",
  upload.single("bannerImage"),
  isAuthenticated,
  isAdmin,
  editServiceCategoryController
);

serviceCategoryRoute.get(
  "/get-service",
  isAuthenticated,
  isAdmin,
  getAllServiceCategoriesController
);

serviceCategoryRoute.get(
  "/get-service/:id",
  isAuthenticated,
  isAdmin,
  getServiceCategoryByIdController
);

serviceCategoryRoute.put(
  "/edit-service-order",
  isAuthenticated,
  isAdmin,
  updateBusinessCategoryOrderController
);

module.exports = serviceCategoryRoute;
