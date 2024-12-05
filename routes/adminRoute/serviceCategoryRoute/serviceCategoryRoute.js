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
  deleteServiceCategoryController,
} = require("../../../controllers/admin/serviceCategory/serviceCategoryController");
const { body } = require("express-validator");

const serviceCategoryRoute = express.Router();

serviceCategoryRoute.post(
  "/add-service",
  upload.single("serviceImage"),
  [
    body("title").notEmpty().withMessage("Title is required"),
    body("geofenceId").notEmpty().withMessage("Geofence id is required"),
  ],
  isAuthenticated,
  isAdmin,
  addServiceCategoryController
);

serviceCategoryRoute.put(
  "/edit-service/:serviceId",
  upload.single("serviceImage"),
  [
    body("title").notEmpty().withMessage("Title is required"),
    body("geofenceId").notEmpty().withMessage("Geofence id is required"),
  ],
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

serviceCategoryRoute.delete(
  "/delete-service/:id",
  isAuthenticated,
  isAdmin,
  deleteServiceCategoryController
);

module.exports = serviceCategoryRoute;
