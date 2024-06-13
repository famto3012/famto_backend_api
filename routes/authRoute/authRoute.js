const express = require("express");
const { body } = require('express-validator');
const {
  registerController,
  loginController,
  blockMerchant,
  addGeofence,
  addPushNotificationController,
  editPushNotificationController,
  deletePushNotificationController,
} = require("../../controllers/admin/authController");
const isAuthenticated = require("../../middlewares/isAuthenticated");
const isAdmin = require("../../middlewares/isAdmin");

const authRoute = express.Router();

authRoute.post("/register", registerController);

authRoute.post("/sign-in", loginController);

authRoute.put(
  "/block-merchant/:merchantId",
  isAuthenticated,
  isAdmin,
  blockMerchant
);

authRoute.post('/add-geofence', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('color').trim().notEmpty().withMessage('Color is required'),
  body('manager').trim().notEmpty().withMessage('Manager is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('coordinates').isArray().withMessage('Coordinates should be an array')
],
 isAuthenticated,
 isAdmin,
 addGeofence);

 authRoute.post(
  "/push-notification",
  [
    body("event").notEmpty().withMessage("Event is required"),
    body("description").notEmpty().withMessage("Description is required")
  ],
  isAuthenticated,
  isAdmin,
  addPushNotificationController
);

authRoute.put(
  "/push-notification/:id",
  isAuthenticated,
  isAdmin,
  editPushNotificationController
);

authRoute.delete("/push-notification/:id",
  isAuthenticated,
  isAdmin,
  deletePushNotificationController);

module.exports = authRoute;
