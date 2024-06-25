const express = require("express");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const {
  getAllCustomersController,
  searchCustomerByNameController,
  filterCustomerByGeofenceController,
  getSingleCustomerController,
  blockCustomerController,
  editCustomerDetailsController,
  getAllRatingsAndReviewsByAgentController,
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

adminCustomerRoute.patch(
  "/block-customer/:customerId",
  isAuthenticated,
  isAdmin,
  blockCustomerController
);

adminCustomerRoute.put(
  "/edit-customer/:customerId",
  isAuthenticated,
  isAdmin,
  editCustomerDetailsController
);

adminCustomerRoute.get(
  "/ratings/:customerId",
  isAuthenticated,
  isAdmin,
  getAllRatingsAndReviewsByAgentController
);

module.exports = adminCustomerRoute;
