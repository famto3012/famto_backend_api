const express = require("express");
const homeRoute = express.Router();

const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const {
  createHomeScreenRealTimeData,
  getHomeScreenRealTimeData,
} = require("../../../controllers/admin/home/homeController");

homeRoute.post(
  "/home-screen-real-time-data",
  isAuthenticated,
  isAdmin,
  createHomeScreenRealTimeData
);

homeRoute.get(
  "/home-screen-real-time-data",
  isAuthenticated,
  isAdmin,
  getHomeScreenRealTimeData
);

module.exports = homeRoute;