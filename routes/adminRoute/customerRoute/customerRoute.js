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
  addCustomerFromCSVController,
  downloadCustomerSampleCSVController,
  searchCustomerByNameForMerchantController,
  downloadCustomerCSVController,
  filterCustomerByGeofenceForMerchantController,
  searchCustomerByNameForOrderController,
  searchCustomerByNameForMerchantToOrderController,
  fetchAllCustomersByAdminController,
  fetchCustomersOfMerchantController,
} = require("../../../controllers/admin/customer/customerController");
const isAdminOrMerchant = require("../../../middlewares/isAdminOrMerchant");
const { upload } = require("../../../utils/imageOperation");
const adminCustomerRoute = express.Router();

// =========================
// ===========CSV===========
// =========================
adminCustomerRoute.get(
  "/download-customer-csv",
  isAuthenticated,
  isAdminOrMerchant,
  downloadCustomerCSVController
);

adminCustomerRoute.get(
  "/download-sample-customer-csv",
  isAuthenticated,
  isAdminOrMerchant,
  downloadCustomerSampleCSVController
);

// ========================
// ========Merchant========
// ========================

// TODO: Remove after panel V2
adminCustomerRoute.get(
  "/customer-of-merchant",
  isAuthenticated,
  isAdminOrMerchant,
  getCustomersOfMerchant
);

// TODO: Remove after panel V2
adminCustomerRoute.get(
  "/search-customer-of-merchant",
  isAuthenticated,
  isAdminOrMerchant,
  searchCustomerByNameForMerchantController
);

// TODO: Remove after panel V2
adminCustomerRoute.get(
  "/filter-customer-of-merchant",
  isAuthenticated,
  filterCustomerByGeofenceForMerchantController
);

adminCustomerRoute.get(
  "/fetch-customer-of-merchant",
  isAuthenticated,
  fetchCustomersOfMerchantController
);

adminCustomerRoute.get(
  "/search-customer-of-merchant-for-order",
  isAuthenticated,
  isAdminOrMerchant,
  searchCustomerByNameForMerchantToOrderController
);

// =========================
// ==========Admin==========
// =========================

// TODO: Remover after- panel V2
adminCustomerRoute.get(
  "/get-all",
  isAuthenticated,
  isAdmin,
  getAllCustomersController
);

// TODO: Remover after- panel V2
adminCustomerRoute.get(
  "/search",
  isAuthenticated,
  isAdmin,
  searchCustomerByNameController
);

// TODO: Remover after- panel V2
adminCustomerRoute.get(
  "/",
  isAuthenticated,
  isAdmin,
  filterCustomerByGeofenceController
);

adminCustomerRoute.get(
  "/search-for-order",
  isAuthenticated,
  isAdmin,
  searchCustomerByNameForOrderController
);

adminCustomerRoute.get(
  "/fetch-customer",
  isAuthenticated,
  isAdmin,
  fetchAllCustomersByAdminController
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

adminCustomerRoute.post(
  "/upload-customer-csv",
  isAuthenticated,
  isAdminOrMerchant,
  upload.single("customerCSV"),
  addCustomerFromCSVController
);

module.exports = adminCustomerRoute;
