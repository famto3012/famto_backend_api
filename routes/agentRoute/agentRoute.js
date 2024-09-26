const express = require("express");
const {
  registerAgentController,
  agentLoginController,
  getAgentProfileDetailsController,
  editAgentProfileController,
  getBankDetailController,
  addVehicleDetailsController,
  addGovernmentCertificatesController,
  toggleOnlineController,
  getAllVehicleDetailsController,
  updateAgentBankDetailController,
  getSingleVehicleDetailController,
  editAgentVehicleController,
  deleteAgentVehicleController,
  changeVehicleStatusController,
  rateCustomerController,
  updateLocationController,
  getCurrentDayAppDetailController,
  getHistoryOfAppDetailsController,
  getRatingsOfAgentController,
  getTaskPreviewController,
  getPickUpDetailController,
  addCustomOrderItemPriceController,
  addOrderDetailsController,
  getDeliveryDetailController,
  confirmCashReceivedController,
  addRatingsToCustomer,
  completeOrderController,
  getCashInHandController,
  depositeCashToFamtoController,
  verifyDepositController,
  getAgentTransactionsController,
  getAgentEarningsLast7DaysController,
  updateCustomOrderStatusController,
  getCheckoutDetailController,
  getCompleteOrderMessageController,
  deleteAgentProfileController,
  generateRazorpayQRController,
  verifyQrPaymentController,
  getAllNotificationsController,
  getAllAnnouncementsController,
  checkPaymentStatusOfOrder,
  getAppDrawerDetailsController,
} = require("../../controllers/agent/agentController");
const { upload } = require("../../utils/imageOperation");
const isAuthenticated = require("../../middlewares/isAuthenticated");
const {
  vehicleDetailValidations,
  governmentCertificateValidation,
  bankDetailValidations,
  editAgentValidations,
  agentRegisterValidations,
  agentLoginValidation,
} = require("../../middlewares/validators/agentAppValidations/agentAppValidations");

const agentRoute = express.Router();

// Update location
agentRoute.patch("/update-location", isAuthenticated, updateLocationController);

//Agent register
agentRoute.post(
  "/register",
  upload.single("agentImage"),
  agentRegisterValidations,
  registerAgentController
);

//Agent login
agentRoute.post("/login", agentLoginValidation, agentLoginController);

//Get agent's drawer data
agentRoute.get(
  "/get-drawer-data",
  isAuthenticated,
  getAppDrawerDetailsController
);

//Get agent's profile data
agentRoute.get(
  "/get-profile",
  isAuthenticated,
  getAgentProfileDetailsController
);

//Edit agent's profile data
agentRoute.put(
  "/edit-agent",
  upload.single("agentImage"),
  editAgentValidations,
  isAuthenticated,
  editAgentProfileController
);

// Delete agent profile
agentRoute.delete(
  "/delete-profile",
  isAuthenticated,
  deleteAgentProfileController
);

// Update Agent's Bank details
agentRoute.post(
  "/update-bank-details",
  bankDetailValidations,
  isAuthenticated,
  updateAgentBankDetailController
);

//Get Agent's Bank details
agentRoute.get("/get-bank-details", isAuthenticated, getBankDetailController);

//Add agents's vehicle details
agentRoute.post(
  "/add-vehicle-details",
  upload.fields([
    { name: "rcFrontImage", maxCount: 1 },
    { name: "rcBackImage", maxCount: 1 },
  ]),
  vehicleDetailValidations,
  isAuthenticated,
  addVehicleDetailsController
);

//Add agent's government certificates
agentRoute.post(
  "/add-government-certificates",
  upload.fields([
    { name: "aadharFrontImage", maxCount: 1 },
    { name: "aadharBackImage", maxCount: 1 },
    { name: "drivingLicenseFrontImage", maxCount: 1 },
    { name: "drivingLicenseBackImage", maxCount: 1 },
  ]),
  governmentCertificateValidation,
  isAuthenticated,
  addGovernmentCertificatesController
);

// Change agents status to Free or Inactive
agentRoute.patch("/toggle-online", isAuthenticated, toggleOnlineController);

// Get all vehicle details of agent
agentRoute.get(
  "/vehicle-details",
  isAuthenticated,
  getAllVehicleDetailsController
);

// Get single vehicle detail
agentRoute.get(
  "/vehicles/:vehicleId",
  isAuthenticated,
  getSingleVehicleDetailController
);

// Edit agent vehicle
agentRoute.put(
  "/edit-vehicle-details/:vehicleId",
  upload.fields([
    { name: "rcFrontImage", maxCount: 1 },
    { name: "rcBackImage", maxCount: 1 },
  ]),
  vehicleDetailValidations,
  isAuthenticated,
  editAgentVehicleController
);

agentRoute.delete(
  "/delete-vehicle/:vehicleId",
  isAuthenticated,
  deleteAgentVehicleController
);

agentRoute.put(
  "/change-vehicle-status/:vehicleId",
  isAuthenticated,
  changeVehicleStatusController
);

// Rate customer by order
agentRoute.post(
  "/rate-customer/:orderId",
  isAuthenticated,
  rateCustomerController
);

// Get current day statistics of agent
agentRoute.get(
  "/current-day-detail",
  isAuthenticated,
  getCurrentDayAppDetailController
);

agentRoute.get(
  "/app-detail-history",
  isAuthenticated,
  getHistoryOfAppDetailsController
);

agentRoute.get("/get-ratings", isAuthenticated, getRatingsOfAgentController);

agentRoute.get("/get-task-preview", isAuthenticated, getTaskPreviewController);

agentRoute.get(
  "/get-pickup-detail/:taskId",
  isAuthenticated,
  getPickUpDetailController
);

agentRoute.get(
  "/get-delivery-detail/:taskId",
  isAuthenticated,
  getDeliveryDetailController
);

agentRoute.patch(
  "/add-item-price/:orderId/:itemId",
  isAuthenticated,
  addCustomOrderItemPriceController
);

agentRoute.post(
  "/add-order-detail/:orderId",
  upload.fields([
    { name: "signatureImage", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  isAuthenticated,
  addOrderDetailsController
);

agentRoute.get(
  "/checkout/:taskId",
  isAuthenticated,
  getCheckoutDetailController
);

agentRoute.patch(
  "/confirm-cash",
  isAuthenticated,
  confirmCashReceivedController
);

agentRoute.post("/complete-order", isAuthenticated, completeOrderController);

agentRoute.post(
  "/add-rating-to-customer/:orderId",
  isAuthenticated,
  addRatingsToCustomer
);

agentRoute.get("/get-cash-in-hand", isAuthenticated, getCashInHandController);

agentRoute.post(
  "/initiate-deposite",
  isAuthenticated,
  depositeCashToFamtoController
);

agentRoute.post(
  "/verify-cash-deposite",
  isAuthenticated,
  verifyDepositController
);

agentRoute.get(
  "/agent-transaction-history",
  isAuthenticated,
  getAgentTransactionsController
);

agentRoute.get(
  "/agent-earning-history-for-week",
  isAuthenticated,
  getAgentEarningsLast7DaysController
);

agentRoute.post(
  "/update-shop/:orderId",
  isAuthenticated,
  updateCustomOrderStatusController
);

agentRoute.get(
  "/get-order-earning/:orderId",
  isAuthenticated,
  getCompleteOrderMessageController
);

agentRoute.post("/generate-qr", generateRazorpayQRController);

agentRoute.post("/razorpay-webhook", verifyQrPaymentController);

agentRoute.get(
  "/check-payment-status/:orderId",
  isAuthenticated,
  checkPaymentStatusOfOrder
);

agentRoute.get(
  "/all-notifications",
  isAuthenticated,
  getAllNotificationsController
);

agentRoute.get(
  "/all-announcements",
  isAuthenticated,
  getAllAnnouncementsController
);

module.exports = agentRoute;
