const express = require("express");
const {
  addTaxController,
  getAllTaxController,
  getSinglTaxController,
  editTaxController,
  deleteTaxController,
  disableOrEnableStatusController,
} = require("../../../controllers/admin/tax/taxController");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const taxRoute = express.Router();

taxRoute.post("/add-tax", isAuthenticated, isAdmin, addTaxController);
taxRoute.get("/all-tax", isAuthenticated, isAdmin, getAllTaxController);
taxRoute.get("/:taxId", isAuthenticated, isAdmin, getSinglTaxController);
taxRoute.put("/edit-tax/:taxId", isAuthenticated, isAdmin, editTaxController);
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
