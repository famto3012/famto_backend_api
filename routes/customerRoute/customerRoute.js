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
  getCustomerAppBannerController,
  getSpalshScreenImageController,
  getPickAndDropBannersController,
  getCustomOrderBannersController,
  getAvailableServiceController,
  generateReferralCode,
  getSelectedOngoingOrderDetailController,
  getAllNotificationsOfCustomerController,
  getAvailableGeofences,
  setSelectedGeofence,
  getCurrentOngoingOrders,
  getAllScheduledOrdersOfCustomer,
  getScheduledOrderDetailController,
} = require("../../controllers/customer/customerController");
const {
  getAllBusinessCategoryController,
  homeSearchController,
  filterMerchantController,
  searchProductsInMerchantController,
  filterAndSortProductsController,
  toggleProductFavoriteController,
  toggleMerchantFavoriteController,
  addRatingToMerchantController,
  getTotalRatingOfMerchantController,
  addOrUpdateCartItemController,
  applyPromocodeController,
  orderPaymentController,
  verifyOnlinePaymentController,
  listRestaurantsController,
  cancelOrderBeforeCreationController,
  getAllCategoriesOfMerchants,
  getAllProductsOfMerchantController,
  searchMerchantsOrProducts,
  getProductVariantsByProductIdController,
  getdeliveryOptionOfMerchantController,
  clearCartController,
  applyTipController,
  confirmOrderDetailController,
  getCartBillController,
} = require("../../controllers/customer/universalOrderController");
const {
  addPickUpAddressController,
  addPickandDropItemsController,
  addTipAndApplyPromocodeInPickAndDropController,
  confirmPickAndDropController,
  verifyPickAndDropPaymentController,
  cancelPickBeforeOrderCreationController,
  getVehiclePricingDetalsController,
} = require("../../controllers/customer/pickAndDropController");
const {
  addShopController,
  addItemsToCartController,
  editItemInCartController,
  deleteItemInCartController,
  addDeliveryAddressController,
  addTipAndApplyPromocodeInCustomOrderController,
  confirmCustomOrderController,
  cancelCustomBeforeOrderCreationController,
  getSingleItemController,
} = require("../../controllers/customer/customOrderController");

const customerRoute = express.Router();

// Authenticate route
customerRoute.post(
  "/authenticate",
  customerAuthenticateValidations,
  registerAndLoginController
);

// Get available geofence
customerRoute.get("/all-geofence", isAuthenticated, getAvailableGeofences);

// Set selected geofence
customerRoute.post("/set-geofence", isAuthenticated, setSelectedGeofence);

// Get customer profile route
customerRoute.get("/profile", isAuthenticated, getCustomerProfileController);

// Edit customer profile route
customerRoute.put(
  "/edit-profile",
  upload.single("imageURL"),
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
customerRoute.post(
  "/all-business-categories",
  isAuthenticated,
  getAllBusinessCategoryController
);

// Search in home
customerRoute.get("/search-home", isAuthenticated, homeSearchController);

// List all restaurants in customers geofence
customerRoute.post(
  "/list-restaurants",
  isAuthenticated,
  listRestaurantsController
);

// List all restaurants in customers geofence
customerRoute.get(
  "/search-merchant-or-product",
  isAuthenticated,
  searchMerchantsOrProducts
);

// Get all categories a merchant
customerRoute.get(
  "/:merchantId/:businessCategoryId/categories",
  isAuthenticated,
  getAllCategoriesOfMerchants
);

// Get all products a merchant
customerRoute.get(
  "/merchant/:categoryId/products/:customerId",
  isAuthenticated,
  getAllProductsOfMerchantController
);

// Get variants of a product
customerRoute.get(
  "/merchant/product/:productId/variants",
  isAuthenticated,
  getProductVariantsByProductIdController
);

// Filter merchants by criteria (Pure veg, Rating, Nearby)
customerRoute.post(
  "/filter-merchants",
  isAuthenticated,
  filterMerchantController
);

// Search products in merchant
customerRoute.get(
  "/search-products/:merchantId/:businessCategoryId",
  isAuthenticated,
  searchProductsInMerchantController
);

customerRoute.get(
  "/products/filter-and-sort/:merchantId",
  isAuthenticated,
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
  isAuthenticated,
  getTotalRatingOfMerchantController
);

// Update cart items
customerRoute.put(
  "/update-cart",
  updateCartProductValidations,
  isAuthenticated,
  addOrUpdateCartItemController
);

// Get merchant delivery option
customerRoute.get(
  "/merchant/:merchantId/delivery-option",
  isAuthenticated,
  getdeliveryOptionOfMerchantController
);

// Update cart address details
customerRoute.post(
  "/cart/add-details",
  isAuthenticated,
  // addCartDetailsController
  confirmOrderDetailController
);

customerRoute.post(
  "/apply-promocode",
  isAuthenticated,
  applyPromocodeController
);

customerRoute.post("/add-tip", isAuthenticated, applyTipController);

customerRoute.post("/confirm-order", isAuthenticated, orderPaymentController);

customerRoute.post(
  "/verify-payment",
  isAuthenticated,
  verifyOnlinePaymentController
);

customerRoute.post(
  "/cancel-universal-order/:orderId",
  isAuthenticated,
  cancelOrderBeforeCreationController
);

customerRoute.delete(
  "/clear-cart/:cartId",
  isAuthenticated,
  clearCartController
);

customerRoute.post(
  "/wallet-recharge",
  isAuthenticated,
  addWalletBalanceController
);

customerRoute.post(
  "/verify-wallet-recharge",
  isAuthenticated,
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
  "/scheduled-orders",
  isAuthenticated,
  getAllScheduledOrdersOfCustomer
);

customerRoute.get(
  "/orders/:orderId",
  isAuthenticated,
  getsingleOrderDetailController
);

customerRoute.get(
  "/scheduled-orders-detail",
  isAuthenticated,
  getScheduledOrderDetailController
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

customerRoute.get("/get-cart-bill", isAuthenticated, getCartBillController);

// -------------------------------------
// PICK AND DROP
// -------------------------------------

customerRoute.post(
  "/add-pick-and-drop-address",
  upload.fields([
    { name: "voiceInstructionInPickup", maxCount: 1 },
    { name: "voiceInstructionInDelivery", maxCount: 1 },
  ]),
  isAuthenticated,
  addPickUpAddressController
);

customerRoute.get(
  "/get-vehicle-charges/:cartId",
  isAuthenticated,
  getVehiclePricingDetalsController
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
  isAuthenticated,
  confirmPickAndDropController
);

customerRoute.post(
  "/verify-pick-and-drop",
  isAuthenticated,
  verifyPickAndDropPaymentController
);

customerRoute.post(
  "/cancel-pick-and-drop-order/:orderId",
  isAuthenticated,
  cancelPickBeforeOrderCreationController
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

customerRoute.get(
  "/get-item/:itemId",
  isAuthenticated,
  getSingleItemController
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
  upload.single("voiceInstructiontoAgent"),
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

customerRoute.post(
  "/cancel-custom-order/:orderId",
  isAuthenticated,
  cancelCustomBeforeOrderCreationController
);

// Current orders

customerRoute.get(
  "/current-ongoing-orders",
  isAuthenticated,
  getCurrentOngoingOrders
);

customerRoute.get(
  "/get-current-order/:orderId",
  isAuthenticated,
  getSelectedOngoingOrderDetailController
);

// ============================================
// App Banners
// ============================================

customerRoute.get("/app-banners", getCustomerAppBannerController);

customerRoute.get("/app-splash-screen", getSpalshScreenImageController);

customerRoute.get("/pick-and-drop-banners", getPickAndDropBannersController);

customerRoute.get("/custom-order-banners", getCustomOrderBannersController);

customerRoute.get("/available-services", getAvailableServiceController);

customerRoute.get("/generate-referral", isAuthenticated, generateReferralCode);

customerRoute.get("/referral-status", generateReferralCode);

customerRoute.get(
  "/all-notifications",
  isAuthenticated,
  getAllNotificationsOfCustomerController
);

customerRoute.get(
  "/customization/timings",
  isAuthenticated,
  getAllNotificationsOfCustomerController
);

module.exports = customerRoute;
