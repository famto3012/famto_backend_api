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
  filterProductByFavoriteController,
  addRatingToMerchantController,
  filterProductsByTypeController,
  filterAndSortProductsController,
  getTotalRatingOfMerchantController,
  addItemsToCartController,
  updateCartItemQuantityController,
  addOrUpdateCartItemController,
  addCartDetailsController,
  applyPromocodeController,
  orderPaymentController,
  verifyOnlinePaymentController,
  addWalletBalanceController,
  verifyWalletRechargeController,
  rateDeliveryAgentController,
  getFavoriteMerchantsController,
  getCustomerOrdersController,
  getsingleOrderDetailController,
  getTransactionOfCustomerController,
  getCustomerSubscriptionDetailController,
  getPromocodesOfCustomerController,
  searchPromocodeController,
  searchOrderController,
  getWalletAndLoyaltyController,
} = require("../../controllers/customer/customerController");
const isAuthenticated = require("../../middlewares/isAuthenticated");
const { upload } = require("../../utils/imageOperation");
const {
  customerAuthenticateValidations,
  updateAddressValidations,
  ratingValidations,
  updateCartProductValidations,
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

customerRoute.get(
  "/products/filter-and-sort/:merchantId",
  filterAndSortProductsController
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

// Get rating details of customer
customerRoute.get(
  "/merchant-rating-details/:merchantId",
  getTotalRatingOfMerchantController
);

// Update cart items
customerRoute.put(
  "/update-cart",
  updateCartProductValidations,
  isAuthenticated,
  addOrUpdateCartItemController
);

// Update cart address details
customerRoute.post(
  "/cart/add-details",
  isAuthenticated,
  addCartDetailsController
);

customerRoute.post(
  "/apply-promocode",
  isAuthenticated,
  applyPromocodeController
);

customerRoute.post("/confirm-order", isAuthenticated, orderPaymentController);

customerRoute.post(
  "/verify-payment",
  isAuthenticated,
  verifyOnlinePaymentController
);

customerRoute.post(
  "/wallet-recharge",
  // isAuthenticated,
  addWalletBalanceController
);

customerRoute.post(
  "/verify-wallet-recharge",
  // isAuthenticated,
  verifyWalletRechargeController
);

customerRoute.post(
  "/rate-agent/:orderId",
  isAuthenticated,
  rateDeliveryAgentController
);

customerRoute.get(
  "/favorite-merchants",
  isAuthenticated,
  getFavoriteMerchantsController
);

customerRoute.get("/orders", isAuthenticated, getCustomerOrdersController);

customerRoute.get(
  "/orders/:orderId",
  isAuthenticated,
  getsingleOrderDetailController
);

customerRoute.get("/search-orders", isAuthenticated, searchOrderController);

customerRoute.get(
  "/transaction-details",
  isAuthenticated,
  getTransactionOfCustomerController
);

customerRoute.get(
  "/subscription-details",
  isAuthenticated,
  getCustomerSubscriptionDetailController
);

customerRoute.get(
  "/all-promocodes",
  isAuthenticated,
  getPromocodesOfCustomerController
);

customerRoute.get(
  "/search-promocodes",
  isAuthenticated,
  searchPromocodeController
);

customerRoute.get(
  "/get-wallet-and-loyalty",
  isAuthenticated,
  getWalletAndLoyaltyController
);

module.exports = customerRoute;
