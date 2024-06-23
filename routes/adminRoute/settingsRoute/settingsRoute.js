const express = require("express");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const {
  getUserProfileController,
  updateUserProfileController,
} = require("../../../controllers/admin/settings/settingsController");
const settingsRoute = express.Router();

settingsRoute.get("/", isAuthenticated, getUserProfileController);

settingsRoute.put(
  "/update-settings",
  isAuthenticated,
  updateUserProfileController
);

module.exports = settingsRoute;
