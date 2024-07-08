const express = require("express");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const {
  getUserProfileController,
  updateUserProfileController,
  changeUserPasswordController,
} = require("../../../controllers/admin/settings/settingsController");
const settingsRoute = express.Router();

settingsRoute.get("/", isAuthenticated, getUserProfileController);

settingsRoute.put(
  "/update-settings",
  isAuthenticated,
  updateUserProfileController
);

settingsRoute.patch(
  "/change-password",
  isAuthenticated,
  changeUserPasswordController
);

module.exports = settingsRoute;
