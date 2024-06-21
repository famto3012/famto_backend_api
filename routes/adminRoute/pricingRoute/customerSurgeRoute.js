const express = require("express");
const {
  addCustomerSurgeController,
  getAllCustomerSurgeController,
  getSingleCustomerSurgeController,
  editCustomerSurgeController,
  deleteCustomerSurgeController,
  changeStatusCustomerSurgeController,
} = require("../../../controllers/admin/pricing/customerSurgeController");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const {
  surgeValidations,
} = require("../../../middlewares/validators/pricingValidations");
const customerSurgeRoute = express.Router();

//Add customer surge
customerSurgeRoute.post(
  "/add-customer-surge",
  surgeValidations,
  isAuthenticated,
  isAdmin,
  addCustomerSurgeController
);

//Get all customer surge
customerSurgeRoute.get(
  "/get-all-customer-surge",
  isAuthenticated,
  isAdmin,
  getAllCustomerSurgeController
);

//Get single customer surge
customerSurgeRoute.get(
  "/:customerSurgeId",
  isAuthenticated,
  isAdmin,
  getSingleCustomerSurgeController
);

//Edit customer surge
customerSurgeRoute.put(
  "/edit-customer-surge/:customerSurgeId",
  surgeValidations,
  isAuthenticated,
  isAdmin,
  editCustomerSurgeController
);

//Delete customer surge
customerSurgeRoute.delete(
  "/delete-customer-surge/:customerSurgeId",
  isAuthenticated,
  isAdmin,
  deleteCustomerSurgeController
);

//Change customer surge status
customerSurgeRoute.post(
  "/change-status/:customerSurgeId",
  isAuthenticated,
  isAdmin,
  changeStatusCustomerSurgeController
);

module.exports = customerSurgeRoute;
