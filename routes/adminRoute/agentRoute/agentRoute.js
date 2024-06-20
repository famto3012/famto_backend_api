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
const {
  addAgentByAdminValidations,
  editAgentByAdminValidations,
} = require("../../../middlewares/validators/agentValidation");

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
  addAgentByAdminValidations,
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
  editAgentByAdminValidations,
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
