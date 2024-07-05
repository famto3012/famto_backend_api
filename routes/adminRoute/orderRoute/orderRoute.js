const express = require("express");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const {
  getAllOrdersOfMerchantController,
} = require("../../../controllers/admin/order/orderController");
const orderRoute = express.Router();

orderRoute.get(
  "/all-orders",
  isAuthenticated,
  getAllOrdersOfMerchantController
);

module.exports = orderRoute;
