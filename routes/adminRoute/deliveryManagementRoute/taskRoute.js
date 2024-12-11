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
  getTaskByIdController,
  getTasksController,
  getAgentsController,
} = require("../../../controllers/admin/deliveryManagement/taskController");

//TODO: Remove after panel v2
taskRoute.get("/task", isAdmin, isAuthenticated, getTaskFilterController);

taskRoute.get("/task/:taskId", isAdmin, isAuthenticated, getTaskByIdController);

//TODO: Remove after panel v2
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

//TODO: Remove after panel v2
taskRoute.post(
  "/get-order-id",
  isAdmin,
  isAuthenticated,
  getOrderByOrderIdController
);

//TODO: Remove after panel v2
taskRoute.get(
  "/agent-name",
  isAdmin,
  isAuthenticated,
  getAgentByNameController
);

//TODO: Remove after panel v2
taskRoute.get(
  "/task-date",
  isAdmin,
  isAuthenticated,
  getTaskByDateRangeController
);

taskRoute.get(
  "/task-filter",
  isAdmin,
  isAuthenticated,
  getTasksController
);

taskRoute.get(
  "/agent-filter",
  isAdmin,
  isAuthenticated,
  getAgentsController
);

module.exports = taskRoute;
