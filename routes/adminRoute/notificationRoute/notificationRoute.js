const express = require("express");
const { body } = require("express-validator");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const {
  addNotificationSettingController,
  editNotificationSettingController,
  deleteNotificationSettingController,
  getAllNotificationSettingController,
  searchNotificationSettingController,
  getNotificationSettingController,
  addPushNotificationController,
  deletePushNotificationController,
  searchPushNotificationController,
  getAllPushNotificationController,
  fetchPushNotificationController,
} = require("../../../controllers/admin/notification/notificationController");
const { upload } = require("../../../utils/imageOperation");

const notificationRoute = express.Router();

notificationRoute.post(
  "/notification-setting",
  [
    body("event").notEmpty().withMessage("Event is required"),
    body("description").notEmpty().withMessage("Description is required"),
  ],
  isAuthenticated,
  isAdmin,
  addNotificationSettingController
);

notificationRoute.put(
  "/notification-setting/:id",
  isAuthenticated,
  isAdmin,
  editNotificationSettingController
);

notificationRoute.delete(
  "/notification-setting/:id",
  isAuthenticated,
  isAdmin,
  deleteNotificationSettingController
);

notificationRoute.get(
  "/notification-setting",
  isAuthenticated,
  isAdmin,
  getAllNotificationSettingController
);

notificationRoute.get(
  "/notification-setting-search",
  isAuthenticated,
  isAdmin,
  searchNotificationSettingController
);

notificationRoute.get(
  "/notification-setting/:notificationSettingId",
  isAuthenticated,
  isAdmin,
  getNotificationSettingController
);

notificationRoute.post(
  "/push-notification",
  upload.single("pushNotificationImage"),
  [
    body("title").notEmpty().withMessage("Title is required"),
    body("description").notEmpty().withMessage("Description is required"),
    body("geofence").notEmpty().withMessage("Geofence is required"),
  ],
  isAuthenticated,
  isAdmin,
  addPushNotificationController
);

notificationRoute.delete(
  "/push-notification/:id",
  isAuthenticated,
  isAdmin,
  deletePushNotificationController
);

notificationRoute.get(
  "/push-notification-search",
  isAuthenticated,
  isAdmin,
  searchPushNotificationController
);

notificationRoute.get(
  "/push-notification",
  isAuthenticated,
  isAdmin,
  getAllPushNotificationController
);

notificationRoute.get(
  "/push-notification-type",
  isAuthenticated,
  isAdmin,
  fetchPushNotificationController
);


module.exports = notificationRoute;
