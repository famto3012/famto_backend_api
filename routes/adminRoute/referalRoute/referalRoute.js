const express = require("express");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const {
  addOrUpdateReferalController,
  getReferalController,
} = require("../../../controllers/admin/referal/referalController");
const referalRoute = express.Router();

referalRoute.post(
  "/add-referal",
  isAuthenticated,
  isAdmin,
  addOrUpdateReferalController
);

referalRoute.get(
  "/referal-criteria",
  isAuthenticated,
  isAdmin,
  getReferalController
);

module.exports = referalRoute;
