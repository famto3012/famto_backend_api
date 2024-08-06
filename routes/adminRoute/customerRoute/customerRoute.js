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
  addMoneyToWalletController,
  deductMoneyFromWalletCOntroller,
  getCustomersOfMerchant,
} = require("../../../controllers/admin/customer/customerController");
const isAdminOrMerchant = require("../../../middlewares/isAdminOrMerchant");
const adminCustomerRoute = express.Router();

adminCustomerRoute.get(
  "/customer-of-merchant",
  isAuthenticated,
  isAdminOrMerchant,
  getCustomersOfMerchant
);

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

adminCustomerRoute.patch(
  "/add-money-to-wallet/:customerId",
  isAuthenticated,
  isAdmin,
  addMoneyToWalletController
);

adminCustomerRoute.patch(
  "/deduct-money-from-wallet/:customerId",
  isAuthenticated,
  isAdmin,
  deductMoneyFromWalletCOntroller
);

module.exports = adminCustomerRoute;
