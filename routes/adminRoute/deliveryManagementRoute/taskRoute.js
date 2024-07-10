
const express = require("express");
const taskRoute = express.Router();
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const { getTaskFilterController, getAgentByStatusController } = require("../../../controllers/admin/deliveryManagement/taskController");

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

module.exports = taskRoute;
