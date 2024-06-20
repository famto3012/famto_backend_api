const express = require("express");
const {
  addMerchantSurgeController,
  getAllMerchantSurgeController,
  getSingleMerchantSurgeController,
  editMerchantSurgeController,
  deleteMerchantSurgeController,
  changeStatusMerchantSurgeController,
} = require("../../../controllers/admin/pricing/merchantSurgeController");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const merchantSurgeRoute = express.Router();

//Add merchant surge
merchantSurgeRoute.post(
  "/add-merchant-surge",
  isAuthenticated,
  isAdmin,
  addMerchantSurgeController
);

//Get all merchant surge
merchantSurgeRoute.get(
  "/get-all-merchant-surge",
  isAuthenticated,
  isAdmin,
  getAllMerchantSurgeController
);

//Get single merchant surge
merchantSurgeRoute.get(
  "/:merchantSurgeId",
  isAuthenticated,
  isAdmin,
  getSingleMerchantSurgeController
);

//Edit merchant surge
merchantSurgeRoute.put(
  "/edit-merchant-surge/:merchantSurgeId",
  isAuthenticated,
  isAdmin,
  editMerchantSurgeController
);

//Delete merchant surge
merchantSurgeRoute.delete(
  "/delete-merchant-surge/:merchantSurgeId",
  isAuthenticated,
  isAdmin,
  deleteMerchantSurgeController
);

//Change merchant surge status
merchantSurgeRoute.post(
  "/change-status/:merchantSurgeId",
  isAuthenticated,
  isAdmin,
  changeStatusMerchantSurgeController
);

module.exports = merchantSurgeRoute;
