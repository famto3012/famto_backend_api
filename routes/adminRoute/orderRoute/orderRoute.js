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
  getAvailableMerchantBusinessCategoriesController,
  markScheduledOrderViewedController,
  fetchAllOrderOfMerchant,
  fetchAllScheduledOrdersOfMerchant,
  downloadCSVByMerchantController,
} = require("../../../controllers/admin/order/merchantOrderController");
const {
  getAllOrdersForAdminController,
  confirmOrderByAdminController,
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
  orderMarkAsReadyController,
  markTakeAwayOrderCompletedController,
  getScheduledOrderDetailByAdminController,
  fetchAllOrdersByAdminController,
  fetchAllScheduledOrdersByAdminController,
  markOrderAsCompletedByAdminController,
} = require("../../../controllers/admin/order/adminOrderController");
const isAdmin = require("../../../middlewares/isAdmin");
const { upload } = require("../../../utils/imageOperation");
const isAdminOrMerchant = require("../../../middlewares/isAdminOrMerchant");
const orderRoute = express.Router();

// -------------------------------------------------
// For Merchant
// -------------------------------------------------

orderRoute.get(
  "/available-business-categories",
  isAuthenticated,
  getAvailableMerchantBusinessCategoriesController
);

orderRoute.get("/get-orders", isAuthenticated, fetchAllOrderOfMerchant);

orderRoute.get(
  "/get-scheduled-orders",
  isAuthenticated,
  fetchAllScheduledOrdersOfMerchant
);

// TODO: Remove after panel V2
orderRoute.get(
  "/all-orders",
  isAuthenticated,
  getAllOrdersOfMerchantController
);

// TODO: Remove after panel V2
orderRoute.get(
  "/all-scheduled-orders",
  isAuthenticated,
  getAllScheduledOrdersOfMerchantController
);

// TODO: Remove after panel V2
orderRoute.get("/search-order", isAuthenticated, searchOrderByIdController);

// TODO: Remove after panel V2
orderRoute.get(
  "/search-scheduled-order",
  isAuthenticated,
  searchScheduledOrderByIdController
);

// TODO: Remove after panel V2
orderRoute.get("/filter", isAuthenticated, filterOrdersController);

// TODO: Remove after panel V2
orderRoute.get(
  "/filter-scheduled",
  isAuthenticated,
  filterScheduledOrdersController
);

// TODO: Remove after panel V2
orderRoute.get(
  "/download-csv",
  isAuthenticated,
  isAdminOrMerchant,
  downloadOrdersCSVByMerchantController
);

orderRoute.get(
  "/download-order-csv",
  isAuthenticated,
  isAdminOrMerchant,
  downloadCSVByMerchantController
);

orderRoute.get(
  "/scheduled-order/:orderId",
  isAuthenticated,
  getScheduledOrderDetailController
);

orderRoute.put(
  "/scheduled-order-view/:orderId/:merchantId",
  isAuthenticated,
  markScheduledOrderViewedController
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
  "/mark-as-ready/:orderId",
  isAuthenticated,
  isAdminOrMerchant,
  orderMarkAsReadyController
);

orderRoute.put(
  "/mark-as-completed/:orderId",
  isAuthenticated,
  isAdminOrMerchant,
  markTakeAwayOrderCompletedController
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
  "/admin/get-orders",
  isAuthenticated,
  isAdmin,
  fetchAllOrdersByAdminController
);

orderRoute.get(
  "/admin/get-scheduled-orders",
  isAuthenticated,
  isAdmin,
  fetchAllScheduledOrdersByAdminController
);

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
  "/admin/scheduled-order/:id",
  isAuthenticated,
  isAdmin,
  getScheduledOrderDetailByAdminController
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
  confirmOrderByAdminController
);

orderRoute.patch(
  "/admin/mark-as-completed/:orderId",
  isAuthenticated,
  isAdmin,
  markOrderAsCompletedByAdminController
);

module.exports = orderRoute;
