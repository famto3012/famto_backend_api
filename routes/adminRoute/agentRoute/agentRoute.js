const express = require("express");
const {
  addAgentByAdminController,
  editAgentByAdminController,
  getSingleAgentController,
  approveOrDeclineRegistrationController,
  getRatingsByCustomerController,
  getAgentByVehicleTypeController,
  getAgentByGeofenceController,
} = require("../../../controllers/admin/agent/agentCOntroller");
const { upload } = require("../../../utils/imageOperation");
const { body, check } = require("express-validator");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");

const agentRoute = express.Router();

//Add Agent by admin route
agentRoute.post(
  "/add-agents",
  upload.fields([
    { name: "rcFrontImage", maxCount: 1 },
    { name: "rcBackImage", maxCount: 1 },
    { name: "aadharFrontImage", maxCount: 1 },
    { name: "aadharBackImage", maxCount: 1 },
    { name: "drivingLicenseFrontImage", maxCount: 1 },
    { name: "drivingLicenseBackImage", maxCount: 1 },
    { name: "agentImage", maxCount: 1 },
  ]),
  [
    body("fullName").trim().notEmpty().withMessage("Full name is required"),
    body("email").trim().isEmail().withMessage("Valid email is required"),
    body("phoneNumber")
      .trim()
      .notEmpty()
      .withMessage("Phone number is required"),
    body("licensePlate").trim().notEmpty().withMessage("Full name is required"),
    body("model").trim().notEmpty().withMessage("Full name is required"),
    body("type").trim().notEmpty().withMessage("Full name is required"),
    check("rcFrontImage").custom((value, { req }) => {
      if (!req.files || !req.files.rcFrontImage) {
        throw new Error("RC front image is required");
      }
      return true;
    }),
    check("rcBackImage").custom((value, { req }) => {
      if (!req.files || !req.files.rcBackImage) {
        throw new Error("RC back image is required");
      }
      return true;
    }),
    body("accountHolderName")
      .trim()
      .notEmpty()
      .withMessage("Full name is required"),
    body("accountNumber")
      .trim()
      .notEmpty()
      .withMessage("Full name is required"),
    body("IFSCCode").trim().notEmpty().withMessage("Full name is required"),
    body("UPIId").trim().notEmpty().withMessage("Full name is required"),
    body("aadharNumber").trim().notEmpty().withMessage("Full name is required"),
    body("drivingLicenseNumber")
      .trim()
      .notEmpty()
      .withMessage("Full name is required"),
    check("aadharFrontImage").custom((value, { req }) => {
      if (!req.files || !req.files.aadharFrontImage) {
        throw new Error("Aadhar front image is required");
      }
      return true;
    }),
    check("aadharBackImage").custom((value, { req }) => {
      if (!req.files || !req.files.aadharBackImage) {
        throw new Error("Aadhar back image is required");
      }
      return true;
    }),
    check("drivingLicenseFrontImage").custom((value, { req }) => {
      if (!req.files || !req.files.drivingLicenseFrontImage) {
        throw new Error("Driving license front image is required");
      }
      return true;
    }),
    check("drivingLicenseBackImage").custom((value, { req }) => {
      if (!req.files || !req.files.drivingLicenseBackImage) {
        throw new Error("Driving license back image is required");
      }
      return true;
    }),
    body("manager").trim().notEmpty().withMessage("Full name is required"),
    body("salaryStructure")
      .trim()
      .notEmpty()
      .withMessage("Full name is required"),
    body("geofenceId").trim().notEmpty().withMessage("Full name is required"),
    body("tag").trim().notEmpty().withMessage("Full name is required"),
    check("agentImage").custom((value, { req }) => {
      if (!req.files || !req.files.agentImage) {
        throw new Error("Agent image is required");
      }
      return true;
    }),
  ],
  isAuthenticated,
  isAdmin,
  addAgentByAdminController
);

//Edit agent details by admin
agentRoute.put(
  "/edit-agent/:agentId",
  upload.fields([
    { name: "rcFrontImage", maxCount: 1 },
    { name: "rcBackImage", maxCount: 1 },
    { name: "aadharFrontImage", maxCount: 1 },
    { name: "aadharBackImage", maxCount: 1 },
    { name: "drivingLicenseFrontImage", maxCount: 1 },
    { name: "drivingLicenseBackImage", maxCount: 1 },
    { name: "agentImage", maxCount: 1 },
  ]),
  [
    body("fullName").trim().notEmpty().withMessage("Full name is required"),
    body("email").trim().isEmail().withMessage("Valid email is required"),
    body("phoneNumber")
      .trim()
      .notEmpty()
      .withMessage("Phone number is required"),
    body("licensePlate").trim().notEmpty().withMessage("Full name is required"),
    body("model").trim().notEmpty().withMessage("Full name is required"),
    body("type").trim().notEmpty().withMessage("Full name is required"),
    check("rcFrontImage").custom((value, { req }) => {
      if (
        !req.body.rcFrontImageURL &&
        (!req.files || !req.files.rcFrontImage)
      ) {
        throw new Error("RC front image is required");
      }
      return true;
    }),
    check("rcBackImage").custom((value, { req }) => {
      if (!req.body.rcBackImageURL && (!req.files || !req.files.rcBackImage)) {
        throw new Error("RC back image is required");
      }
      return true;
    }),
    body("accountHolderName")
      .trim()
      .notEmpty()
      .withMessage("Full name is required"),
    body("accountNumber")
      .trim()
      .notEmpty()
      .withMessage("Full name is required"),
    body("IFSCCode").trim().notEmpty().withMessage("Full name is required"),
    body("UPIId").trim().notEmpty().withMessage("Full name is required"),
    body("aadharNumber").trim().notEmpty().withMessage("Full name is required"),
    body("drivingLicenseNumber")
      .trim()
      .notEmpty()
      .withMessage("Full name is required"),
    check("aadharFrontImage").custom((value, { req }) => {
      if (
        !req.body.aadharFrontImageURL &&
        (!req.files || !req.files.aadharFrontImage)
      ) {
        throw new Error("Aadhar front image is required");
      }
      return true;
    }),
    check("aadharBackImage").custom((value, { req }) => {
      if (
        !req.body.aadharBackImageURL &&
        (!req.files || !req.files.aadharBackImage)
      ) {
        throw new Error("Aadhar back image is required");
      }
      return true;
    }),
    check("drivingLicenseFrontImage").custom((value, { req }) => {
      if (
        !req.body.drivingLicenseFrontImageURL &&
        (!req.files || !req.files.drivingLicenseFrontImage)
      ) {
        throw new Error("Driving license front image is required");
      }
      return true;
    }),
    check("drivingLicenseBackImage").custom((value, { req }) => {
      if (
        !req.body.drivingLicenseBackImageURL &&
        (!req.files || !req.files.drivingLicenseBackImage)
      ) {
        throw new Error("Driving license back image is required");
      }
      return true;
    }),
    body("manager").trim().notEmpty().withMessage("Full name is required"),
    body("salaryStructure")
      .trim()
      .notEmpty()
      .withMessage("Full name is required"),
    body("geofenceId").trim().notEmpty().withMessage("Full name is required"),
    body("tag").trim().notEmpty().withMessage("Full name is required"),
    check("agentImage").custom((value, { req }) => {
      if (!req.body.agentImageURL && (!req.files || !req.files.agentImage)) {
        throw new Error("Agent image is required");
      }
      return true;
    }),
  ],
  isAuthenticated,
  isAdmin,
  editAgentByAdminController
);

//Get Agent by vehicle type
agentRoute.get(
  "/filter-by-vehicle",
  isAuthenticated,
  isAdmin,
  getAgentByVehicleTypeController
);

//Get Agent by geofence
agentRoute.get(
  "/filter-by-geofence",
  isAuthenticated,
  isAdmin,
  getAgentByGeofenceController
);

//Get single agent
agentRoute.get("/:agentId", isAuthenticated, isAdmin, getSingleAgentController);

//Approve OR Decline registration
agentRoute.put(
  "/:agentId",
  isAuthenticated,
  isAdmin,
  approveOrDeclineRegistrationController
);

//Get ratings of agent by customer
agentRoute.get(
  "/:agentId/get-ratings-by-customer",
  isAuthenticated,
  isAdmin,
  getRatingsByCustomerController
);

module.exports = agentRoute;
