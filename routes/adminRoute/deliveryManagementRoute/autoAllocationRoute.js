const express = require("express");
const autoAllocationRoute = express.Router();
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const {
  addAndUpdateAutoAllocationController,
  updateAutoAllocationStatus,
  getAutoAllocationController,
} = require("../../../controllers/admin/deliveryManagement/autoAllocationController");

autoAllocationRoute.post(
  "/add",
  isAdmin,
  isAuthenticated,
  addAndUpdateAutoAllocationController
);

autoAllocationRoute.get(
  "/get",
  isAdmin,
  isAuthenticated,
  getAutoAllocationController
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
