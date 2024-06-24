const express = require("express");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const {
  getAllCustomersController,
  searchCustomerByNameController,
  filterCustomerByGeofenceController,
  getSingleCustomerController,
} = require("../../../controllers/admin/customer/customerController");
const adminCustomerRoute = express.Router();

adminCustomerRoute.get(
  "/get-all",
  isAuthenticated,
  isAdmin,
  getAllCustomersController
);

adminCustomerRoute.get(
  "/search",
  isAuthenticated,
  isAdmin,
  searchCustomerByNameController
);

adminCustomerRoute.get(
  "/",
  isAuthenticated,
  isAdmin,
  filterCustomerByGeofenceController
);

adminCustomerRoute.get(
  "/:customerId",
  isAuthenticated,
  isAdmin,
  getSingleCustomerController
);

module.exports = adminCustomerRoute;
