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
} = require("../../../controllers/admin/merchant/merchantController");
const { upload } = require("../../../utils/imageOperation");
const isAdmin = require("../../../middlewares/isAdmin");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const {
  merchantDetailValidations,
  merchantValidations,
} = require("../../../middlewares/validators/merchantValidations");

const merchantRoute = express.Router();

//Register merchant
merchantRoute.post(
  "/register",
  merchantValidations,
  registerMerchantController
);

//Change status
merchantRoute.patch(
  "/change-status",
  isAuthenticated,
  changeMerchantStatusByMerchantController
);

//Update Merchant details
merchantRoute.put(
  "/update-merchant-details",
  upload.fields([
    { name: "merchantImage", maxCount: 1 },
    { name: "pancardImage", maxCount: 1 },
    { name: "GSTINImage", maxCount: 1 },
    { name: "FSSAIImage", maxCount: 1 },
    { name: "aadharImage", maxCount: 1 },
  ]),
  merchantDetailValidations,
  isAuthenticated,
  updateMerchantDetailsController
);

//Sponsorship payment
merchantRoute.post(
  "/sponsorship-payment",
  isAuthenticated,
  sponsorshipPaymentController
);

//Verify sponsorship payment
merchantRoute.post("/verify-payment", isAuthenticated, verifyPaymentController);

//-------------------------------
//For Admin
//-------------------------------

//Approve merchant registration
merchantRoute.patch(
  "/admin/approve-merchant/:merchantId",
  isAuthenticated,
  isAdmin,
  approveRegistrationController
);

//Decline merchant registration
merchantRoute.patch(
  "/admin/reject-merchant/:merchantId",
  isAuthenticated,
  isAdmin,
  rejectRegistrationController
);

// Search merchant
merchantRoute.get(
  "/admin/search",
  isAuthenticated,
  isAdmin,
  searchMerchantController
);

// Filter merchant
merchantRoute.get(
  "/admin/filter",
  isAuthenticated,
  isAdmin,
  filterMerchantsController
);

//Get all merchants
merchantRoute.get(
  "/admin/all-merchants",
  isAuthenticated,
  isAdmin,
  getAllMerchantsController
);

//Get single merchant
merchantRoute.get(
  "/admin/:merchantId",
  isAuthenticated,
  isAdmin,
  getSingleMerchantController
);

// Edit merchant
merchantRoute.put(
  "/admin/edit-merchant/:merchantId",
  merchantValidations,
  isAuthenticated,
  isAdmin,
  editMerchantController
);

merchantRoute.patch(
  "/admin/change-status/:merchantId",
  changeMerchantStatusController
);

//Update Merchant details
merchantRoute.put(
  "/admin/update-merchant-details/:merchantId",
  upload.fields([
    { name: "merchantImage", maxCount: 1 },
    { name: "pancardImage", maxCount: 1 },
    { name: "GSTINImage", maxCount: 1 },
    { name: "FSSAIImage", maxCount: 1 },
    { name: "aadharImage", maxCount: 1 },
  ]),
  merchantDetailValidations,
  isAuthenticated,
  isAdmin,
  updateMerchantDetailsController
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

module.exports = merchantRoute;
