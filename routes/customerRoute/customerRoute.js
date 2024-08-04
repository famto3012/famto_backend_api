const express = require("express");
const isAuthenticated = require("../../middlewares/isAuthenticated");
const { upload } = require("../../utils/imageOperation");
const {
  customerAuthenticateValidations,
  updateAddressValidations,
  ratingValidations,
  updateCartProductValidations,
} = require("../../middlewares/validators/customerAppValidations/customerAppValidations");

const {
  registerAndLoginController,
  getCustomerProfileController,
  updateCustomerProfileController,
  updateCustomerAddressController,
  getCustomerAddressController,
  addWalletBalanceController,
  verifyWalletRechargeController,
  rateDeliveryAgentController,
  getFavoriteMerchantsController,
  getCustomerOrdersController,
  getsingleOrderDetailController,
  searchOrderController,
  getTransactionOfCustomerController,
  getCustomerSubscriptionDetailController,
  getPromocodesOfCustomerController,
  searchPromocodeController,
  getWalletAndLoyaltyController,
  getCustomerCartController,
} = require("../../controllers/customer/customerController");
const {
  getAllBusinessCategoryController,
  homeSearchController,
  listRestaurantsController,
  getMerchantWithCategoriesAndProductsController,
  filterMerchantController,
  searchProductsInMerchantController,
  filterAndSortProductsController,
  toggleProductFavoriteController,
  toggleMerchantFavoriteController,
  addRatingToMerchantController,
  getTotalRatingOfMerchantController,
  addOrUpdateCartItemController,
  addCartDetailsController,
  applyPromocodeController,
  orderPaymentController,
  verifyOnlinePaymentController,
} = require("../../controllers/customer/universalOrderController");
const {
  addPickUpAddressController,
  addPickandDropItemsController,
  addTipAndApplyPromocodeInPickAndDropController,
  confirmPickAndDropController,
  verifyPickAndDropPaymentController,
} = require("../../controllers/customer/pickAndDropController");
const {
  addShopController,
  addItemsToCartController,
  editItemInCartController,
  deleteItemInCartController,
  addDeliveryAddressController,
  addTipAndApplyPromocodeInCustomOrderController,
  confirmCustomOrderController,
} = require("../../controllers/customer/customOrderController");

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
  // isAuthenticated,
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

customerRoute.get("/get-cart", isAuthenticated, getCustomerCartController);

// -------------------------------------
// PICK AND DROP
// -------------------------------------

customerRoute.post(
  "/add-pick-and-drop-address",
  isAuthenticated,
  addPickUpAddressController
);

customerRoute.post(
  "/add-pick-and-drop-items",
  isAuthenticated,
  addPickandDropItemsController
);

customerRoute.post(
  "/add-tip-and-promocode",
  isAuthenticated,
  addTipAndApplyPromocodeInPickAndDropController
);

customerRoute.post(
  "/confirm-pick-and-drop",
  // isAuthenticated,
  confirmPickAndDropController
);

customerRoute.post(
  "/verify-pick-and-drop",
  // isAuthenticated,
  verifyPickAndDropPaymentController
);

// -------------------------------------
// CUSTOM ORDER
// -------------------------------------

customerRoute.post("/add-shop", isAuthenticated, addShopController);

customerRoute.post(
  "/add-item",
  upload.single("itemImage"),
  isAuthenticated,
  addItemsToCartController
);

customerRoute.patch(
  "/edit-item/:itemId",
  upload.single("itemImage"),
  isAuthenticated,
  editItemInCartController
);

customerRoute.delete(
  "/delete-item/:itemId",
  isAuthenticated,
  deleteItemInCartController
);

customerRoute.post(
  "/add-delivery-address",
  isAuthenticated,
  addDeliveryAddressController
);

customerRoute.post(
  "/add-custom-tip-and-promocode",
  isAuthenticated,
  addTipAndApplyPromocodeInCustomOrderController
);

customerRoute.post(
  "/confirm-custom-order",
  isAuthenticated,
  confirmCustomOrderController
);

module.exports = customerRoute;
