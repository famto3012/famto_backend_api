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
  getAllScheduledOrdersOfMerchantController,
  downloadOrdersCSVByMerchantController,
  filterScheduledOrdersController,
  searchScheduledOrderByIdController,
  getScheduledOrderDetailController,
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
  getAllScheduledOrdersForAdminController,
  downloadOrdersCSVByAdminController,
  downloadInvoiceBillController,
  downloadOrderBillController,
  filterScheduledOrdersByAdminController,
  searchScheduledOrderByIdByAdminController,
} = require("../../../controllers/admin/order/adminOrderController");
const isAdmin = require("../../../middlewares/isAdmin");
const { upload } = require("../../../utils/imageOperation");
const isAdminOrMerchant = require("../../../middlewares/isAdminOrMerchant");
const {
  adminInvoiceValidations,
} = require("../../../middlewares/validators/orderValidations");
const orderRoute = express.Router();

// -------------------------------------------------
// For Merchant
// -------------------------------------------------

orderRoute.get(
  "/all-orders",
  isAuthenticated,
  getAllOrdersOfMerchantController
);

orderRoute.get(
  "/all-scheduled-orders",
  isAuthenticated,
  getAllScheduledOrdersOfMerchantController
);

orderRoute.get("/search-order", isAuthenticated, searchOrderByIdController);

orderRoute.get(
  "/search-scheduled-order",
  isAuthenticated,
  searchScheduledOrderByIdController
);

orderRoute.get("/filter", isAuthenticated, filterOrdersController);

orderRoute.get(
  "/filter-scheduled",
  isAuthenticated,
  filterScheduledOrdersController
);

orderRoute.get(
  "/download-csv",
  isAuthenticated,
  isAdmin,
  downloadOrdersCSVByMerchantController
);

orderRoute.get(
  "/scheduled-order/:orderId",
  isAuthenticated,
  getScheduledOrderDetailController
);

orderRoute.get("/:orderId", isAuthenticated, getOrderDetailController);

orderRoute.post(
  "/create-order-invoice",
  isAuthenticated,
  createInvoiceController
);

orderRoute.post("/create-order", isAuthenticated, createOrderController);

orderRoute.post(
  "/download-invoice-bill",
  isAuthenticated,
  isAdminOrMerchant,
  downloadInvoiceBillController
);

orderRoute.post(
  "/download-order-bill",
  isAuthenticated,
  isAdminOrMerchant,
  downloadOrderBillController
);

orderRoute.put(
  "/reject-order/:orderId",
  isAuthenticated,
  rejectOrderController
);

orderRoute.patch(
  "/confirm-order/:orderId",
  isAuthenticated,
  confirmOrderController
);

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
  "/admin/search-scheduled-order",
  isAuthenticated,
  isAdmin,
  searchScheduledOrderByIdByAdminController
);

orderRoute.get(
  "/admin/filter",
  isAuthenticated,
  isAdmin,
  filterOrdersByAdminController
);

orderRoute.get(
  "/admin/filter-scheduled",
  isAuthenticated,
  isAdmin,
  filterScheduledOrdersByAdminController
);

orderRoute.get(
  "/admin/all-orders",
  isAuthenticated,
  isAdmin,
  getAllOrdersForAdminController
);

orderRoute.get(
  "/admin/all-scheduled-orders",
  isAuthenticated,
  isAdmin,
  getAllScheduledOrdersForAdminController
);

orderRoute.get(
  "/admin/download-csv",
  isAuthenticated,
  isAdmin,
  downloadOrdersCSVByAdminController
);

orderRoute.get(
  "/admin/:orderId",
  isAuthenticated,
  isAdmin,
  getOrderDetailByAdminController
);

orderRoute.post(
  "/admin/create-order-invoice",
  upload.any(),
  // adminInvoiceValidations,
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

orderRoute.put(
  "/admin/reject-order/:orderId",
  isAuthenticated,
  isAdmin,
  rejectOrderByAdminController
);

orderRoute.patch(
  "/admin/confirm-order/:orderId",
  isAuthenticated,
  isAdmin,
  confirmOrderByAdminContrroller
);

module.exports = orderRoute;
