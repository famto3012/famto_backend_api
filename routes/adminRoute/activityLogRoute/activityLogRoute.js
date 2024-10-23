const express = require("express");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const {
  getAllActivityLogsController,
} = require("../../../controllers/admin/activityLogs/activityLogController");

const activityLogRoute = express.Router();

activityLogRoute.get(
  "/",
  isAuthenticated,
  isAdmin,
  getAllActivityLogsController
);

module.exports = activityLogRoute;
