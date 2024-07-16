
const express = require("express");
const taskRoute = express.Router();
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const { getTaskFilterController, getAgentByStatusController, assignAgentToTaskController } = require("../../../controllers/admin/deliveryManagement/taskController");

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

module.exports = taskRoute;
