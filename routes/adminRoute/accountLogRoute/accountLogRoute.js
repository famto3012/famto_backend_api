const express = require("express");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const {
  searchUserByRoleController,
  searchUserByDateController,
  unBlockUserController,
  searchUserByNameController,
  filterUserInAccountLogs,
  downloadUserCSVInAccountLogs,
} = require("../../../controllers/admin/accountLogs/accountLogsController");

const accountLogRoute = express.Router();

accountLogRoute.get(
  "/search-role",
  isAuthenticated,
  isAdmin,
  searchUserByRoleController
);

accountLogRoute.get(
  "/search",
  isAuthenticated,
  isAdmin,
  searchUserByNameController
);

accountLogRoute.get(
  "/search-date",
  isAuthenticated,
  isAdmin,
  searchUserByDateController
);

accountLogRoute.get(
  "/filter",
  isAuthenticated,
  isAdmin,
  filterUserInAccountLogs
);

accountLogRoute.get(
  "/csv",
  isAuthenticated,
  isAdmin,
  downloadUserCSVInAccountLogs
);

accountLogRoute.put(
  "/unblock-user/:userId",
  isAuthenticated,
  isAdmin,
  unBlockUserController
);

module.exports = accountLogRoute;
