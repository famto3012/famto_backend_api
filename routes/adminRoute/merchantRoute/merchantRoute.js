const express = require("express");
const {
  getAllMerchantsController,
  registerMerchantController,
  approveRegistrationController,
  rejectRegistrationController,
  getSingleMerchantController,
  updateMerchantDetailsController,
  sponsorshipPaymentController,
  verifyPaymentController,
  changeMerchantStatusController,
  changeMerchantStatusByMerchantController,
  searchMerchantController,
  blockMerchant,
  editMerchantController,
  filterMerchantsController,
  updateMerchantDetailsByMerchantController,
  addMerchantController,
  getMerchantProfileController,
  editMerchantProfileController,
  addMerchantsFromCSVController,
  downloadMerchantSampleCSVController,
  downloadMerchantCSVController,
  deleteMerchantProfileByAdminController,
  getAllMerchantsForDropDownController,
  changeMerchantStatusByMerchantControllerForToggle,
  getMerchantPayoutController,
  getMerchantPayoutDetail,
  confirmMerchantPayout,
  downloadPayoutCSVController,
  fetchAllMerchantsController,
} = require("../../../controllers/admin/merchant/merchantController");
const { upload } = require("../../../utils/imageOperation");
const isAdmin = require("../../../middlewares/isAdmin");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const {
  merchantDetailValidations,
  merchantValidations,
} = require("../../../middlewares/validators/merchantValidations");

const merchantRoute = express.Router();

// Register merchant
merchantRoute.post(
  "/register",
  merchantValidations,
  registerMerchantController
);

// Change status
merchantRoute.patch(
  "/change-status",
  isAuthenticated,
  changeMerchantStatusByMerchantController
);

merchantRoute.patch(
  "/change-status-toggle",
  isAuthenticated,
  changeMerchantStatusByMerchantControllerForToggle
);

// Get merchant profile
merchantRoute.get("/profile", isAuthenticated, getMerchantProfileController);

// Edit merchant profile
merchantRoute.put(
  "/edit-profile",
  merchantValidations,
  isAuthenticated,
  editMerchantProfileController
);

//  Update Merchant details
merchantRoute.put(
  "/update-merchant-details",
  upload.fields([
    { name: "merchantImage", maxCount: 1 },
    { name: "pancardImage", maxCount: 1 },
    { name: "gstinImage", maxCount: 1 },
    { name: "fssaiImage", maxCount: 1 },
    { name: "aadharImage", maxCount: 1 },
  ]),
  isAuthenticated,
  updateMerchantDetailsByMerchantController
);

// Sponsorship payment
merchantRoute.post(
  "/sponsorship-payment/:merchantId",
  isAuthenticated,
  sponsorshipPaymentController
);

// Verify sponsorship payment
merchantRoute.post(
  "/verify-payment/:merchantId",
  isAuthenticated,
  verifyPaymentController
);

// -------------------------------
// For Admin
// -------------------------------

// Get all merchant for drop-down
merchantRoute.get(
  "/admin/all-merchant-drop-down",
  isAuthenticated,
  isAdmin,
  getAllMerchantsForDropDownController
);

merchantRoute.get(
  "/admin/fetch-merchant",
  isAuthenticated,
  isAdmin,
  fetchAllMerchantsController
);

// TODO: Remove after panel V2
//  Search merchant
merchantRoute.get(
  "/admin/search",
  isAuthenticated,
  isAdmin,
  searchMerchantController
);

// TODO: Remove after panel V2
//  Filter merchant
merchantRoute.get(
  "/admin/filter",
  isAuthenticated,
  isAdmin,
  filterMerchantsController
);

// TODO: Remove after panel V2
// Get all merchants
merchantRoute.get(
  "/admin/all-merchants",
  isAuthenticated,
  isAdmin,
  getAllMerchantsController
);

// Download sample CSV
merchantRoute.get(
  "/admin/download-sample-merchant-csv",
  isAuthenticated,
  isAdmin,
  downloadMerchantSampleCSVController
);

// Approve merchant registration
merchantRoute.patch(
  "/admin/approve-merchant/:merchantId",
  isAuthenticated,
  isAdmin,
  approveRegistrationController
);

// Decline merchant registration
merchantRoute.patch(
  "/admin/reject-merchant/:merchantId",
  isAuthenticated,
  isAdmin,
  rejectRegistrationController
);

// Get all merchants payout
merchantRoute.get(
  "/admin/payout",
  isAuthenticated,
  isAdmin,
  getMerchantPayoutController
);

merchantRoute.get(
  "/admin/payout-csv",
  isAuthenticated,
  isAdmin,
  downloadPayoutCSVController
);

// Get merchants payout detail
merchantRoute.get(
  "/admin/payout-detail",
  isAuthenticated,
  isAdmin,
  getMerchantPayoutDetail
);

// Get single merchant
merchantRoute.get(
  "/admin/:merchantId",
  isAuthenticated,
  isAdmin,
  getSingleMerchantController
);

// Add merchant
merchantRoute.post(
  "/admin/add-merchant",
  merchantValidations,
  isAuthenticated,
  isAdmin,
  addMerchantController
);

// Edit merchant
merchantRoute.put(
  "/admin/edit-merchant/:merchantId",
  merchantValidations,
  isAuthenticated,
  isAdmin,
  editMerchantController
);

// Change merchant status
merchantRoute.patch(
  "/admin/change-status/:merchantId",
  isAuthenticated,
  isAdmin,
  changeMerchantStatusController
);

// Update merchant payout status
merchantRoute.patch(
  "/admin/payout/:merchantId/:payoutId",
  isAuthenticated,
  isAdmin,
  confirmMerchantPayout
);

//Update Merchant details
merchantRoute.put(
  "/admin/update-merchant-details/:merchantId",
  upload.fields([
    { name: "merchantImage", maxCount: 1 },
    { name: "pancardImage", maxCount: 1 },
    { name: "gstinImage", maxCount: 1 },
    { name: "fssaiImage", maxCount: 1 },
    { name: "aadharImage", maxCount: 1 },
  ]),
  isAuthenticated,
  isAdmin,
  updateMerchantDetailsController
);

// Download Merchant CSV
merchantRoute.post(
  "/admin/download-csv",
  isAuthenticated,
  isAdmin,
  downloadMerchantCSVController
);

//Sponsorship payment
merchantRoute.post(
  "/admin/sponsorship-payment/:merchantId",
  isAuthenticated,
  isAdmin,
  sponsorshipPaymentController
);

//Verify sponsorship payment
merchantRoute.post(
  "/admin/verify-payment/:merchantId",
  isAuthenticated,
  isAdmin,
  verifyPaymentController
);

merchantRoute.put(
  "/admin/block-merchant/:merchantId",
  isAuthenticated,
  isAdmin,
  blockMerchant
);

merchantRoute.post(
  "/admin/upload-merchant-csv",
  upload.single("merchantCSV"),
  isAuthenticated,
  isAdmin,
  addMerchantsFromCSVController
);

merchantRoute.delete(
  "/admin/delete-merchant/:merchantId",
  isAuthenticated,
  isAdmin,
  deleteMerchantProfileByAdminController
);

module.exports = merchantRoute;
