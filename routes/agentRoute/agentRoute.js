const express = require("express");
const {
  registerAgentController,
  agentLoginController,
  submitGovernmentAndVehicleDetailsController,
  getImagesOfDetailsController,
  getAgentProfileDetailsController,
  editAgentProfileController,
  addAgentBankDetailController,
  getBankDetailController,
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

//Add agent's Government certificate & Vehicle details
agentRoute.post(
  "/add-details",
  upload.fields([
    { name: "vehicles", maxCount: 20 },
    { name: "aadharFrontImage", maxCount: 1 },
    { name: "aadharBackImage", maxCount: 1 },
    { name: "drivingLicenseFrontImage", maxCount: 1 },
    { name: "drivingLicenseBackImage", maxCount: 1 },
  ]),
  [
    body("vehicles")
      .isArray({ min: 1 })
      .withMessage("Vehicle details are required"),
    body("vehicles.*.model")
      .trim()
      .notEmpty()
      .withMessage("Vehicle model is required"),
    body("vehicles.*.type")
      .trim()
      .notEmpty()
      .withMessage("Vehicle type is required"),
    body("vehicles.*.licensePlate")
      .trim()
      .notEmpty()
      .withMessage("License plate is required"),
    body("aadharNumber")
      .trim()
      .notEmpty()
      .withMessage("Aadhar number is required"),
    body("drivingLicenseNumber")
      .trim()
      .notEmpty()
      .withMessage("Driving license number is required"),
    check("vehicles").custom((value, { req }) => {
      if (
        !req.files ||
        !req.files.vehicles ||
        req.files.vehicles.length === 0
      ) {
        throw new Error("Vehicle images are required");
      }
      return true;
    }),
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
  submitGovernmentAndVehicleDetailsController
);

//Get agent's images of details
agentRoute.get(
  "/get-image-details",
  isAuthenticated,
  getImagesOfDetailsController
);

//Get agent's profile data
agentRoute.get(
  "/get-profile",
  isAuthenticated,
  getAgentProfileDetailsController
);

//Edit agent's profile data
agentRoute.put(
  "/edit-agent/:agentId",
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

//Add Agent's Bank details
agentRoute.post(
  "/add-bank-details",
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
  addAgentBankDetailController
);

//Edit Agent's Bank details
agentRoute.put(
  "/edit-bank-details/:agentId",
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
  addAgentBankDetailController
);

//Get Agent's Bank details
agentRoute.get("/get-bank-details", isAuthenticated, getBankDetailController);

module.exports = agentRoute;