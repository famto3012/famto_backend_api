const express = require("express");
const taskRoute = express.Router();
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const {
  getTaskFilterController,
  getAgentByStatusController,
  assignAgentToTaskController,
  getAgentsAccordingToGeofenceController,
  getOrderByOrderIdController,
  getAgentByNameController,
  getTaskByDateRangeController,
} = require("../../../controllers/admin/deliveryManagement/taskController");

taskRoute.get("/task", isAdmin, isAuthenticated, getTaskFilterController);

taskRoute.get("/agent", isAdmin, isAuthenticated, getAgentByStatusController);

taskRoute.post(
  "/assign-task/:taskId",
  isAdmin,
  isAuthenticated,
  assignAgentToTaskController
);

taskRoute.post(
  "/agents-in-geofence/:taskId",
  isAdmin,
  isAuthenticated,
  getAgentsAccordingToGeofenceController
);

taskRoute.post(
  "/get-order-id",
  isAdmin,
  isAuthenticated,
  getOrderByOrderIdController
);

taskRoute.get(
  "/agent-name",
  isAdmin,
  isAuthenticated,
  getAgentByNameController
);

taskRoute.get(
  "/task-date",
  isAdmin,
  isAuthenticated,
  getTaskByDateRangeController
);

module.exports = taskRoute;
