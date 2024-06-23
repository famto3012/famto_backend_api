const express = require("express");
const {
  addAgentByAdminController,
  editAgentByAdminController,
  getSingleAgentController,
  getRatingsByCustomerController,
  getAgentByVehicleTypeController,
  getAgentByGeofenceController,
  approveAgentRegistrationController,
  rejectAgentRegistrationController,
} = require("../../../controllers/admin/agent/agentCOntroller");
const { upload } = require("../../../utils/imageOperation");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const {
  addAgentByAdminValidations,
  editAgentByAdminValidations,
} = require("../../../middlewares/validators/agentValidation");

const adminAgentRoute = express.Router();

//Add Agent by admin route
adminAgentRoute.post(
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
adminAgentRoute.put(
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
adminAgentRoute.get(
  "/filter-by-vehicle",
  isAuthenticated,
  isAdmin,
  getAgentByVehicleTypeController
);

//Get Agent by geofence
adminAgentRoute.get(
  "/filter-by-geofence",
  isAuthenticated,
  isAdmin,
  getAgentByGeofenceController
);

//Get single agent
adminAgentRoute.get(
  "/:agentId",
  isAuthenticated,
  isAdmin,
  getSingleAgentController
);

//Approve registration
adminAgentRoute.patch(
  "/approve-registration/:agentId",
  isAuthenticated,
  isAdmin,
  approveAgentRegistrationController
);

//Decline registration
adminAgentRoute.delete(
  "/reject-registration/:agentId",
  isAuthenticated,
  isAdmin,
  rejectAgentRegistrationController
);

//Get ratings of agent by customer
adminAgentRoute.get(
  "/:agentId/get-ratings-by-customer",
  isAuthenticated,
  isAdmin,
  getRatingsByCustomerController
);

module.exports = adminAgentRoute;
