const express = require("express");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const {
  addManagerController,
  getManagerByIdController,
  editManagerController,
  getAllManagersController,
  deleteManagerController,
  getManagerByGeofenceController,
  searchManagerByNameController,
} = require("../../../controllers/admin/manager/managerController");
const { body } = require("express-validator");
const managerRoute = express.Router();

//Search manager by name
managerRoute.get(
  "/search",
  isAuthenticated,
  isAdmin,
  searchManagerByNameController
);

//Filrer manager by geofence
managerRoute.get(
  "/filter",
  isAuthenticated,
  isAdmin,
  getManagerByGeofenceController
);

//Add manager
managerRoute.post(
  "/add-manager",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Invalid email"),
    body("phoneNumber")
      .trim()
      .notEmpty()
      .withMessage("Phone number is required")
      .isMobilePhone()
      .withMessage("Invalid phone number"),
    body("password").trim().notEmpty().withMessage("Password is required"),
    body("role").trim().notEmpty().withMessage("Please select a role"),
    body("merchants").trim().notEmpty().withMessage("Please select a merchant"),
    body("geofenceId")
      .trim()
      .notEmpty()
      .withMessage("Please select a geofence"),
    body("viewCustomers")
      .trim()
      .notEmpty()
      .withMessage("View customer permission is required"),
  ],
  isAuthenticated,
  isAdmin,
  addManagerController
);

//Get manager by Id
managerRoute.get(
  "/:managerId",
  isAuthenticated,
  isAdmin,
  getManagerByIdController
);

//Edit manager
managerRoute.put(
  "/edit-manager/:managerId",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Invalid email"),
    body("phoneNumber")
      .trim()
      .notEmpty()
      .withMessage("Phone number is required")
      .isMobilePhone()
      .withMessage("Invalid phone number"),
    body("password").trim().notEmpty().withMessage("Password is required"),
    body("role").trim().notEmpty().withMessage("Please select a role"),
    body("merchants").trim().notEmpty().withMessage("Please select a merchant"),
    body("geofenceId")
      .trim()
      .notEmpty()
      .withMessage("Please select a geofence"),
    body("viewCustomers")
      .trim()
      .notEmpty()
      .withMessage("View customer permission is required"),
  ],
  isAuthenticated,
  isAdmin,
  editManagerController
);

//Get all managers
managerRoute.get("/", isAuthenticated, isAdmin, getAllManagersController);

//Delete manager
managerRoute.delete(
  "/delete-manager/:managerId",
  isAuthenticated,
  isAdmin,
  deleteManagerController
);

module.exports = managerRoute;
