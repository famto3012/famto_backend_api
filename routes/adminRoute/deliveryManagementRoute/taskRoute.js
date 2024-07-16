
const express = require("express");
const taskRoute = express.Router();
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const { getTaskFilterController, getAgentByStatusController, assignAgentToTaskController, getAgentsAccordingToGeofenceController, getOrderByOrderIdController, getAgentByNameController } = require("../../../controllers/admin/deliveryManagement/taskController");

taskRoute.get(
  "/task",
  isAdmin,
  isAuthenticated,
  getTaskFilterController
);

taskRoute.get(
  "/agent",
  isAdmin,
  isAuthenticated,
  getAgentByStatusController
);

taskRoute.post(
  "/assign-task/:taskId",
  isAdmin,
  isAuthenticated,
  assignAgentToTaskController
);

taskRoute.get(
  "/agents-in-geofence/:taskId",
  isAdmin,
  isAuthenticated,
  getAgentsAccordingToGeofenceController
)

taskRoute.get(
  "/get-order-id",
  isAdmin,
  isAuthenticated,
  getOrderByOrderIdController
)

taskRoute.get(
  "/agent-name",
  isAdmin,
  isAuthenticated,
  getAgentByNameController
)

module.exports = taskRoute;
