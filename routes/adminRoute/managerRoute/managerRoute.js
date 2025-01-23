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
  getManagerRolesController,
  createManagerRoleController,
  editManagerRoleController,
  deleteManagerRoleController,
  fetchAllManagersController,
  getSingleManagerRole,
  getAllowedRoutesOfUser,
} = require("../../../controllers/admin/manager/managerController");
const { body } = require("express-validator");
const managerRoute = express.Router();

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
    body("geofenceId")
      .trim()
      .notEmpty()
      .withMessage("Please select a geofence"),
  ],
  isAuthenticated,
  isAdmin,
  addManagerController
);

managerRoute.get("/manager-roles", getManagerRolesController);

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
    body("geofenceId")
      .trim()
      .notEmpty()
      .withMessage("Please select a geofence"),
  ],
  isAuthenticated,
  isAdmin,
  editManagerController
);

//Get all managers
managerRoute.get("/", isAuthenticated, isAdmin, fetchAllManagersController);

//Delete manager
managerRoute.delete(
  "/delete-manager/:managerId",
  isAuthenticated,
  isAdmin,
  deleteManagerController
);

// +++++++++++++++++++++
// Roles
// +++++++++++++++++++++

managerRoute.get(
  "/manager-roles/:roleId",
  isAuthenticated,
  isAdmin,
  getSingleManagerRole
);

managerRoute.post(
  "/manager-roles",
  isAuthenticated,
  isAdmin,
  createManagerRoleController
);

managerRoute.put(
  "/manager-roles/:roleId",
  isAuthenticated,
  isAdmin,
  editManagerRoleController
);

managerRoute.delete(
  "/manager-roles/:roleId",
  isAuthenticated,
  isAdmin,
  deleteManagerRoleController
);

// ==================
managerRoute.get(
  "/get-allowed-routes",
  isAuthenticated,
  getAllowedRoutesOfUser
);

module.exports = managerRoute;
