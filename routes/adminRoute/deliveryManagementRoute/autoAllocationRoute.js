const express = require("express");
const autoAllocationRoute = express.Router();
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const {
  addAndUpdateAutoAllocationController,
  updateAutoAllocationStatus,
} = require("../../../controllers/admin/deliveryManagement/autoAllocationController");

autoAllocationRoute.post(
  "/add",
  isAdmin,
  isAuthenticated,
  addAndUpdateAutoAllocationController
);

autoAllocationRoute.put(
  "/update",
  isAdmin,
  isAuthenticated,
  addAndUpdateAutoAllocationController
);

autoAllocationRoute.put(
  "/update-status",
  isAdmin,
  isAuthenticated,
  updateAutoAllocationStatus
);

module.exports = autoAllocationRoute;
