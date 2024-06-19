const express = require("express");
const {
  addTaxController,
  getAllTaxController,
  getSinglTaxController,
  editTaxController,
  deleteTaxController,
  disableOrEnableStatusController,
} = require("../../../controllers/admin/tax/taxController");
const taxRoute = express.Router();

taxRoute.post("/add-tax", addTaxController);
taxRoute.get("/all-tax", getAllTaxController);
taxRoute.get("/:taxId", getSinglTaxController);
taxRoute.put("/edit-tax/:taxId", editTaxController);
taxRoute.delete("/delete-tax/:taxId", deleteTaxController);
taxRoute.post("/change-status/:taxId", disableOrEnableStatusController);

module.exports = taxRoute;
