const express = require("express");
const {
  addMerchantPricingController,
  getAllMerchantPricingController,
  getSingleMerchantPricingController,
  editMerchantPricingController,
  deleteMerchantPricingController,
  changeStatusMerchantPricingController,
} = require("../../../controllers/admin/pricing/merchantPricingController");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const {
  merchantPricingValidations,
} = require("../../../middlewares/validators/pricingValidations");
const merchantPricingRoute = express.Router();

//Add merchant pricing
merchantPricingRoute.post(
  "/add-merchant-pricing",
  merchantPricingValidations,
  isAuthenticated,
  isAdmin,
  addMerchantPricingController
);

//Get all merchant pricing
merchantPricingRoute.get(
  "/all-merchant-pricings",
  isAuthenticated,
  isAdmin,
  getAllMerchantPricingController
);

//Get single merchant pricing
merchantPricingRoute.get(
  "/:merchantPricingId",
  isAuthenticated,
  isAdmin,
  getSingleMerchantPricingController
);

//Edit merchant pricing
merchantPricingRoute.put(
  "/edit-merchant-pricing/:merchantPricingId",
  merchantPricingValidations,
  isAuthenticated,
  isAdmin,
  editMerchantPricingController
);

//Delete merchant pricing
merchantPricingRoute.delete(
  "/delete-merchant-pricing/:merchantPricingId",
  isAuthenticated,
  isAdmin,
  deleteMerchantPricingController
);

//Change status merchant pricing
merchantPricingRoute.post(
  "/change-status/:merchantPricingId",
  isAuthenticated,
  isAdmin,
  changeStatusMerchantPricingController
);

module.exports = merchantPricingRoute;
