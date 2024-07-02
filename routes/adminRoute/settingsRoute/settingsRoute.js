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

// TODO: Add route and controller for change password

module.exports = settingsRoute;
