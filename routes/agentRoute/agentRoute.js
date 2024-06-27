const express = require("express");
const {
  registerAgentController,
  agentLoginController,
  getAgentProfileDetailsController,
  editAgentProfileController,
  getBankDetailController,
  checkIsApprovedController,
  addVehicleDetailsController,
  addGovernmentCertificatesController,
  goOnlineController,
  goOfflineController,
  getAllVehicleDetailsController,
  updateAgentBankDetailController,
  getSingleVehicleDetailController,
  editAgentVehicleController,
  deleteAgentVehicleController,
  changeVehicleStatusController,
} = require("../../controllers/agent/agentController");
const { body, check } = require("express-validator");
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

//Agent register
agentRoute.post(
  "/register",
  upload.single("agentImage"),
  agentRegisterValidations,
  registerAgentController
);

//Agent login
agentRoute.post("/login", agentLoginValidation, agentLoginController);

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

// Update Agent's Bank details
agentRoute.post(
  "/update-bank-details",
  bankDetailValidations,
  isAuthenticated,
  updateAgentBankDetailController
);

//Get Agent's Bank details
agentRoute.get("/get-bank-details", isAuthenticated, getBankDetailController);

//Checking approval status
agentRoute.get("/check-approval", isAuthenticated, checkIsApprovedController);

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

// Change agents status to Free
agentRoute.patch("/go-online", isAuthenticated, goOnlineController);

// Change agent's status to Inactive
agentRoute.patch("/go-offline", isAuthenticated, goOfflineController);

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

module.exports = agentRoute;
