const express = require("express");
const { body } = require("express-validator");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const { upload } = require("../../../utils/imageOperation");
const {
  addNotificationSettingController,
  editNotificationSettingController,
  deleteNotificationSettingController,
  getAllNotificationSettingController,
  searchNotificationSettingController,
  getNotificationSettingController,
  editNotificationSettingStatusController,
} = require("../../../controllers/admin/notification/notificationSetting/notificationSettingController");
const {
  addPushNotificationController,
  deletePushNotificationController,
  searchPushNotificationController,
  getAllPushNotificationController,
  fetchPushNotificationController,
  sendPushNotificationController,
} = require("../../../controllers/admin/notification/pushNotification/pushNotificationController");
const {
  addAlertNotificationController,
  deleteAlertNotificationController,
  getAllAlertNotificationsController,
  getAlertNotificationsByUserTypeController,
  searchAlertNotificationsByTitleController,
} = require("../../../controllers/admin/notification/alertNotification/alertNotificationController");
// const {
//   sendNotificationController,
// } = require("../../../controllers/admin/notification/notificationController");
const {
  getAdminNotificationLogController,
  getMerchantNotificationLogController,
} = require("../../../controllers/admin/notification/notificationLog/notificationLogController");

const adminNotificationRoute = express.Router();

adminNotificationRoute.post(
  "/notification-setting",
  [
    body("event").notEmpty().withMessage("Event is required"),
    body("description").notEmpty().withMessage("Description is required"),
  ],
  isAuthenticated,
  isAdmin,
  addNotificationSettingController
);

adminNotificationRoute.put(
  "/notification-setting/:id",
  isAuthenticated,
  isAdmin,
  editNotificationSettingController
);

adminNotificationRoute.put(
  "/notification-setting-status/:id",
  isAuthenticated,
  isAdmin,
  editNotificationSettingStatusController
);

adminNotificationRoute.delete(
  "/notification-setting/:id",
  isAuthenticated,
  isAdmin,
  deleteNotificationSettingController
);

adminNotificationRoute.get(
  "/notification-setting",
  isAuthenticated,
  isAdmin,
  getAllNotificationSettingController
);

adminNotificationRoute.get(
  "/notification-setting-search",
  isAuthenticated,
  isAdmin,
  searchNotificationSettingController
);

adminNotificationRoute.get(
  "/notification-setting/:notificationSettingId",
  isAuthenticated,
  isAdmin,
  getNotificationSettingController
);

adminNotificationRoute.post(
  "/push-notification",
  upload.single("pushNotificationImage"),
  [
    body("title").notEmpty().withMessage("Title is required"),
    body("description").notEmpty().withMessage("Description is required"),
    body("geofenceId").notEmpty().withMessage("Geofence is required"),
  ],
  isAuthenticated,
  isAdmin,
  addPushNotificationController
);

adminNotificationRoute.delete(
  "/push-notification/:id",
  isAuthenticated,
  isAdmin,
  deletePushNotificationController
);

adminNotificationRoute.get(
  "/push-notification-search",
  isAuthenticated,
  isAdmin,
  searchPushNotificationController
);

adminNotificationRoute.get(
  "/push-notification",
  isAuthenticated,
  isAdmin,
  getAllPushNotificationController
);

adminNotificationRoute.get(
  "/push-notification-type",
  isAuthenticated,
  isAdmin,
  fetchPushNotificationController
);

adminNotificationRoute.post(
  "/alert-notification",
  upload.single("alertNotificationImage"),
  [
    body("title").notEmpty().withMessage("Title is required"),
    body("description").notEmpty().withMessage("Description is required"),
    body("id").notEmpty().withMessage("Id is required"),
  ],
  isAuthenticated,
  isAdmin,
  addAlertNotificationController
);

adminNotificationRoute.delete(
  "/alert-notification/:id",
  isAuthenticated,
  isAdmin,
  deleteAlertNotificationController
);

adminNotificationRoute.get(
  "/alert-notification",
  isAuthenticated,
  isAdmin,
  getAllAlertNotificationsController
);

adminNotificationRoute.get(
  "/alert-notification/:userType",
  isAuthenticated,
  isAdmin,
  getAlertNotificationsByUserTypeController
);

adminNotificationRoute.get(
  "/search-alert-notification",
  isAuthenticated,
  isAdmin,
  searchAlertNotificationsByTitleController
);

adminNotificationRoute.post(
  "/send-push-notification/:notificationId",
  isAuthenticated,
  isAdmin,
  sendPushNotificationController
);

adminNotificationRoute.get(
  "/get-admin-notification-log",
  isAuthenticated,
  isAdmin,
  getAdminNotificationLogController
);

adminNotificationRoute.get(
  "/get-merchant-notification-log",
  isAuthenticated,
  getMerchantNotificationLogController
);

module.exports = adminNotificationRoute;
