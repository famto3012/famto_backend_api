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

const agentRoute = express.Router();

//Agent register
agentRoute.post(
  "/register",
  upload.single("agentImage"),
  [
    body("fullName").trim().notEmpty().withMessage("Full name is required"),
    body("email").trim().isEmail().withMessage("Valid email is required"),
    body("phoneNumber")
      .trim()
      .notEmpty()
      .withMessage("Phone number is required"),
    body("latitude").trim().notEmpty().withMessage("Latitude is required"),
    body("longitude").trim().notEmpty().withMessage("Longitude is required"),
    check("agentImage").custom((value, { req }) => {
      if (!req.file) {
        throw new Error("Agent image is required");
      }
      return true;
    }),
  ],
  registerAgentController
);

//Agent login
agentRoute.post(
  "/login",
  [
    body("phoneNumber")
      .trim()
      .notEmpty()
      .withMessage("Phone number is required"),
  ],
  agentLoginController
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
  [
    body("fullName").trim().notEmpty().withMessage("Full name is required"),
    body("email").trim().isEmail().withMessage("Valid email is required"),
    check("agentImage").custom((value, { req }) => {
      if (!req.body.agentImageURL && !req.file) {
        throw new Error("Agent image is required");
      }
      return true;
    }),
  ],
  isAuthenticated,
  editAgentProfileController
);

// Update Agent's Bank details
agentRoute.post(
  "/update-bank-details",
  [
    body("accountHolderName")
      .trim()
      .notEmpty()
      .withMessage("Account holder name is required"),
    body("accountNumber")
      .trim()
      .notEmpty()
      .withMessage("Account number is required"),
    body("IFSCCode").trim().notEmpty().withMessage("IFSC Code is required"),
    body("UPIId").trim().notEmpty().withMessage("UPI Id is required"),
  ],
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
  [
    body("model").trim().notEmpty().withMessage("Vehicle model is required"),
    body("type").trim().notEmpty().withMessage("Vehicle type is required"),
    body("licensePlate")
      .trim()
      .notEmpty()
      .withMessage("License plate is required"),
    check("rcFrontImage").custom((value, { req }) => {
      if (!req.files || !req.files.rcFrontImage) {
        throw new Error("RC Front Image is required for each vehicle");
      }
      return true;
    }),
    check("rcBackImage").custom((value, { req }) => {
      if (!req.files || !req.files.rcBackImage) {
        throw new Error("RC Back Image is required for each vehicle");
      }
      return true;
    }),
  ],
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
  [
    body("aadharNumber")
      .trim()
      .notEmpty()
      .withMessage("Aadhar number is required"),
    body("drivingLicenseNumber")
      .trim()
      .notEmpty()
      .withMessage("Driving license number is required"),
    check("aadharFrontImage").custom((value, { req }) => {
      if (!req.files || !req.files.aadharFrontImage) {
        throw new Error("Aadhar Front Image is required");
      }
      return true;
    }),
    check("aadharBackImage").custom((value, { req }) => {
      if (!req.files || !req.files.aadharBackImage) {
        throw new Error("Aadhar Back Image is required");
      }
      return true;
    }),
    check("drivingLicenseFrontImage").custom((value, { req }) => {
      if (!req.files || !req.files.drivingLicenseFrontImage) {
        throw new Error("Driving License Front Image is required");
      }
      return true;
    }),
    check("drivingLicenseBackImage").custom((value, { req }) => {
      if (!req.files || !req.files.drivingLicenseBackImage) {
        throw new Error("Driving License Back Image is required");
      }
      return true;
    }),
  ],
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
  [
    body("model").trim().notEmpty().withMessage("Vehicle model is required"),
    body("type").trim().notEmpty().withMessage("Vehicle type is required"),
    body("licensePlate")
      .trim()
      .notEmpty()
      .withMessage("License plate is required"),
    check("rcFrontImage").custom((value, { req }) => {
      if (!req.files || !req.files.rcFrontImage) {
        throw new Error("RC Front Image is required for each vehicle");
      }
      return true;
    }),
    check("rcBackImage").custom((value, { req }) => {
      if (!req.files || !req.files.rcBackImage) {
        throw new Error("RC Back Image is required for each vehicle");
      }
      return true;
    }),
  ],
  isAuthenticated,
  editAgentVehicleController
);

agentRoute.delete(
  "/delete-vehicle/:vehicleId",
  isAuthenticated,
  deleteAgentVehicleController
);

agentRoute.put(
  "/change-vehicle-status",
  isAuthenticated,
  changeVehicleStatusController
);

module.exports = agentRoute;
