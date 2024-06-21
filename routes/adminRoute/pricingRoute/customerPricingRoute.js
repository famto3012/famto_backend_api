const express = require("express");
const {
  addCustomerPricingController,
  getAllCustomerPricingController,
  getSingleCustomerPricingController,
  editCustomerPricingController,
  deleteCustomerPricingController,
  changeStatusCustomerPricingController,
} = require("../../../controllers/admin/pricing/customerPricingController");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const {
  customerPricingValidations,
} = require("../../../middlewares/validators/pricingValidations");
const customerPricingRoute = express.Router();

//Add customer pricing
customerPricingRoute.post(
  "/add-customer-pricing",
  customerPricingValidations,
  isAuthenticated,
  isAdmin,
  addCustomerPricingController
);

//Get all customer pricing
customerPricingRoute.get(
  "/get-all-customer-pricing",
  isAuthenticated,
  isAdmin,
  getAllCustomerPricingController
);

//Get single customer pricing
customerPricingRoute.get(
  "/:customerPricingId",
  isAuthenticated,
  isAdmin,
  getSingleCustomerPricingController
);

//Edit customer pricing
customerPricingRoute.put(
  "/edit-customer-pricing/:customerPricingId",
  customerPricingValidations,
  isAuthenticated,
  isAdmin,
  editCustomerPricingController
);

//Delete customer pricing
customerPricingRoute.delete(
  "/delete-customer-pricing/:customerPricingId",
  isAuthenticated,
  isAdmin,
  deleteCustomerPricingController
);

//Change customer pricing status
customerPricingRoute.post(
  "/change-status/:customerPricingId",
  isAuthenticated,
  isAdmin,
  changeStatusCustomerPricingController
);

module.exports = customerPricingRoute;
