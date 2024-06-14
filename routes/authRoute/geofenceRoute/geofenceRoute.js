const express = require("express");
const { body } = require("express-validator");
const {
  addGeofence,
  editGeofence,
  deleteGeofence,
  getAllGeofences,
  getGeofenceById,
} = require("../../../controllers/admin/geofence/geofenceController");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");

const geofenceRoute = express.Router();

geofenceRoute.post(
  "/add-geofence",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("color").trim().notEmpty().withMessage("Color is required"),
    body("orderManager").trim().notEmpty().withMessage("Manager is required"),
    body("description")
      .trim()
      .notEmpty()
      .withMessage("Description is required"),
    body("coordinates").isArray().withMessage("Coordinates should be an array"),
  ],
  isAuthenticated,
  isAdmin,
  addGeofence
);

geofenceRoute.put("/edit-geofence/:id", isAuthenticated, isAdmin, editGeofence);

geofenceRoute.delete("/delete-geofence/:id", isAuthenticated, isAdmin, deleteGeofence);

geofenceRoute.get("/get-geofence", isAuthenticated, isAdmin, getAllGeofences);

geofenceRoute.get("/get-geofence/:id", isAuthenticated, isAdmin, getGeofenceById);

module.exports = geofenceRoute;
