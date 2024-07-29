const express = require("express");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const {
  getAllOrdersOfMerchantController,
  confirmOrderController,
  rejectOrderController,
  searchOrderByIdController,
  filterOrdersController,
  getOrderDetailController,
  createInvoiceController,
  createOrderController,
} = require("../../../controllers/admin/order/merchantOrderController");
const {
  getAllOrdersForAdminController,
  confirmOrderByAdminContrroller,
  rejectOrderByAdminController,
  searchOrderByIdByAdminController,
  filterOrdersByAdminController,
  getOrderDetailByAdminController,
  createInvoiceByAdminController,
  createOrderByAdminController,
} = require("../../../controllers/admin/order/adminOrderController");
const isAdmin = require("../../../middlewares/isAdmin");
const { upload } = require("../../../utils/imageOperation");
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

orderRoute.get("/:orderId", isAuthenticated, getOrderDetailController);

orderRoute.post(
  "/create-order-invoice",
  isAuthenticated,
  createInvoiceController
);

orderRoute.post("/create-order", isAuthenticated, createOrderController);

// -------------------------------------------------
// For Admin
// -------------------------------------------------

orderRoute.get(
  "/admin/search-order",
  isAuthenticated,
  isAdmin,
  searchOrderByIdByAdminController
);

orderRoute.get(
  "/admin/filter",
  isAuthenticated,
  isAdmin,
  filterOrdersByAdminController
);

orderRoute.get(
  "/admin/all-orders",
  isAuthenticated,
  isAdmin,
  getAllOrdersForAdminController
);

orderRoute.get(
  "/admin/:orderId",
  isAuthenticated,
  isAdmin,
  getOrderDetailByAdminController
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

orderRoute.post(
  "/admin/create-order-invoice",
  upload.any(),
  isAuthenticated,
  isAdmin,
  createInvoiceByAdminController
);

orderRoute.post(
  "/admin/create-order",
  isAuthenticated,
  isAdmin,
  createOrderByAdminController
);

module.exports = orderRoute;
