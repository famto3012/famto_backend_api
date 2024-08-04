const express = require("express");
const isAuthenticated = require("../../middlewares/isAuthenticated");
const { getAuthToken } = require("../../controllers/Token/tokenOperation");

const tokenRoute = express.Router();

tokenRoute.get("/get-auth-token", isAuthenticated, getAuthToken);

module.exports = tokenRoute;
