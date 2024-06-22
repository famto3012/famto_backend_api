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
} = require("../../../controllers/admin/merchant/merchantController");
const { upload } = require("../../../utils/imageOperation");
const isAdmin = require("../../../middlewares/isAdmin");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const merchantDetailValidations = require("../../../middlewares/validators/merchantDetailValidations");

const merchantRoute = express.Router();

//Register merchant
merchantRoute.post("/register", registerMerchantController);

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

//Get all merchants
merchantRoute.get(
  "/admin/all-merchants",
  // isAuthenticated,
  // isAdmin,
  getAllMerchantsController
);

//Get single merchant
merchantRoute.get(
  "/:merchantId",
  isAuthenticated,
  isAdmin,
  getSingleMerchantController
);

//Update Merchant details
merchantRoute.put(
  "/update-merchant-details/:merchantId",
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
  "/sponsorship-payment/:merchantId",
  sponsorshipPaymentController
);

//Verify sponsorship payment
merchantRoute.post("/verify-payment/:merchantId", verifyPaymentController);

module.exports = merchantRoute;
