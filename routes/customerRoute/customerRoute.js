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
  getMerchantWithCategoriesAndProductsController,
  filterMerchantController,
  searchProductsInMerchantController,
  toggleProductFavoriteController,
  toggleMerchantFavoriteController,
  filterProductByFavouriteController,
  addRatingToMerchantController,
  filterProductsByTypeController,
} = require("../../controllers/customer/customerController");
const isAuthenticated = require("../../middlewares/isAuthenticated");
const { upload } = require("../../utils/imageOperation");
const {
  customerAuthenticateValidations,
  updateAddressValidations,
  ratingValidations,
} = require("../../middlewares/validators/customerAppValidations/customerAppValidations");

const customerRoute = express.Router();

// Authenticate route
customerRoute.post(
  "/authenticate",
  customerAuthenticateValidations,
  registerAndLoginController
);

// Get customer profile route
customerRoute.get("/profile", isAuthenticated, getCustomerProfileController);

// Edit customer profile route
customerRoute.put(
  "/edit-profile",
  upload.single("customerImage"),
  isAuthenticated,
  updateCustomerProfileController
);

// Update customer address route
customerRoute.patch(
  "/update-address",
  updateAddressValidations,
  isAuthenticated,
  updateCustomerAddressController
);

// Get customer address route
customerRoute.get(
  "/customer-address",
  isAuthenticated,
  getCustomerAddressController
);

// Get all business categories route
customerRoute.get("/all-business-categories", getAllBusinessCategoryController);

// Search in home
customerRoute.get("/search-home", homeSearchController);

// List all restaurants in customers geofence
customerRoute.get("/list-restaurants", listRestaurantsController);

// Get all categories and products of a merchant
customerRoute.get(
  "/merchant-with-categories-and-products/:merchantId",
  getMerchantWithCategoriesAndProductsController
);

// Filter merchants by criteria (Pure veg, Rating, Nearby)
customerRoute.get("/filter-merchants", filterMerchantController);

// Search products in merchant
customerRoute.get(
  "/search-products/:merchantId",
  searchProductsInMerchantController
);

//TODO: Need to work on
// Filter products in merchant (Veg , Non-veg)
customerRoute.get("/filter-products", filterProductsByTypeController);

// Filter favorite products in merchant
customerRoute.get(
  "/favorite-products/:merchantId",
  isAuthenticated,
  filterProductByFavouriteController
);

// Toggle Product favorite
customerRoute.patch(
  "/toggle-product-favorite/:productId",
  isAuthenticated,
  toggleProductFavoriteController
);

// Toggle Merchant favorite
customerRoute.patch(
  "/toggle-merchant-favorite/:merchantId",
  isAuthenticated,
  toggleMerchantFavoriteController
);

// Add ratings to merchant
customerRoute.post(
  "/rate-merchant/:merchantId",
  ratingValidations,
  isAuthenticated,
  addRatingToMerchantController
);

module.exports = customerRoute;
