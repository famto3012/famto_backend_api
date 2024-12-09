const express = require("express");
const {
  addTaxController,
  getAllTaxController,
  getSingleTaxController,
  editTaxController,
  deleteTaxController,
  disableOrEnableStatusController,
} = require("../../../controllers/admin/tax/taxController");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const {
  taxValidations,
} = require("../../../middlewares/validators/taxValidations");
const isAdminOrMerchant = require("../../../middlewares/isAdminOrMerchant");
const taxRoute = express.Router();

taxRoute.post(
  "/add-tax",
  taxValidations,
  isAuthenticated,
  isAdmin,
  addTaxController
);
taxRoute.get(
  "/all-tax",
  isAuthenticated,
  isAdminOrMerchant,
  getAllTaxController
);

taxRoute.get("/:taxId", isAuthenticated, isAdmin, getSingleTaxController);

taxRoute.put(
  "/edit-tax/:taxId",
  taxValidations,
  isAuthenticated,
  isAdmin,
  editTaxController
);

taxRoute.delete(
  "/delete-tax/:taxId",
  isAuthenticated,
  isAdmin,
  deleteTaxController
);

taxRoute.post(
  "/change-status/:taxId",
  isAuthenticated,
  isAdmin,
  disableOrEnableStatusController
);

module.exports = taxRoute;
