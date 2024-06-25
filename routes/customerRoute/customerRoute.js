const express = require("express");
const {
  registerAndLoginController,
  getCustomerProfileController,
  updateCustomerProfileController,
  updateCustomerAddressController,
  getCustomerAddressController,
  getAllBusinessCategoryController,
  homeSearchController,
  listRestaurantsController,
} = require("../../controllers/customer/customerController");
const isAuthenticated = require("../../middlewares/isAuthenticated");
const { upload } = require("../../utils/imageOperation");
const {
  customerAuthenticateValidations,
  updateAddressValidations,
} = require("../../middlewares/validators/customerAppValidations/customerAppValidations");

const customerRoute = express.Router();

customerRoute.post(
  "/authenticate",
  customerAuthenticateValidations,
  registerAndLoginController
);

customerRoute.get("/profile", isAuthenticated, getCustomerProfileController);

customerRoute.put(
  "/edit-profile",
  upload.single("customerImage"),
  isAuthenticated,
  updateCustomerProfileController
);

customerRoute.patch(
  "/update-address",
  updateAddressValidations,
  isAuthenticated,
  updateCustomerAddressController
);

customerRoute.get(
  "/customer-address",
  isAuthenticated,
  getCustomerAddressController
);

customerRoute.get("/all-business-categories", getAllBusinessCategoryController);

customerRoute.get("/search-home", homeSearchController);

customerRoute.get("/list-restaurants", listRestaurantsController);

module.exports = customerRoute;
