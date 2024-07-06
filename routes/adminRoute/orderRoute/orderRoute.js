const express = require("express");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const {
  getAllOrdersOfMerchantController,
  confirmOrderController,
  rejectOrderController,
  searchOrderByIdController,
  filterOrdersController,
  getAllOrdersForAdminController,
  confirmOrderByAdminContrroller,
  rejectOrderByAdminController,
  searchOrderByIdByAdminController,
  filterOrdersByAdminController,
} = require("../../../controllers/admin/order/orderController");
const isAdmin = require("../../../middlewares/isAdmin");
const orderRoute = express.Router();

// -------------------------------------------------
// For Merchant
// -------------------------------------------------

orderRoute.get(
  "/all-orders",
  isAuthenticated,
  getAllOrdersOfMerchantController
);

orderRoute.patch(
  "/confirm-order/:orderId",
  isAuthenticated,
  confirmOrderController
);

orderRoute.put(
  "/reject-order/:orderId",
  isAuthenticated,
  rejectOrderController
);

orderRoute.get("/search-order", isAuthenticated, searchOrderByIdController);

orderRoute.get("/filter", isAuthenticated, filterOrdersController);

// -------------------------------------------------
// For Admin
// -------------------------------------------------

orderRoute.get(
  "/admin/all-orders",
  isAuthenticated,
  isAdmin,
  getAllOrdersForAdminController
);

orderRoute.patch(
  "/admin/confirm-order/:orderId",
  isAuthenticated,
  isAdmin,
  confirmOrderByAdminContrroller
);

orderRoute.put(
  "/admin/reject-order/:orderId",
  isAuthenticated,
  isAdmin,
  rejectOrderByAdminController
);

orderRoute.get(
  "/admin/search-order",
  isAuthenticated,
  isAdmin,
  searchOrderByIdByAdminController
);

orderRoute.get(
  "/admin/filter-by-status",
  isAuthenticated,
  isAdmin,
  filterOrdersByAdminController
);

module.exports = orderRoute;
