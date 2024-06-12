const express = require("express");
const {
  addMerchantController,
  editMerchantController,
} = require("../../controllers/merchant/merchantController");
const { upload } = require("../../utils/imageOperation");
const isAdmin = require("../../middlewares/isAdmin");
const isAuthenticated = require("../../middlewares/isAuthenticated");

const merchantRoute = express.Router();

merchantRoute.post(
  "/add-merchant",
  upload.fields([
    { name: "merchantImage", maxCount: 1 },
    { name: "pancardImage", maxCount: 1 },
    { name: "GSTINImage", maxCount: 1 },
    { name: "FSSAIImage", maxCount: 1 },
    { name: "aadharImage", maxCount: 1 },
  ]),
  isAuthenticated,
  isAdmin,
  addMerchantController
);

merchantRoute.put(
  "/edit-merchant/:merchantId",
  upload.fields([
    { name: "merchantImage", maxCount: 1 },
    { name: "pancardImage", maxCount: 1 },
    { name: "GSTINImage", maxCount: 1 },
    { name: "FSSAIImage", maxCount: 1 },
    { name: "aadharImage", maxCount: 1 },
  ]),
  isAuthenticated,
  isAdmin,
  editMerchantController
);

module.exports = merchantRoute;
