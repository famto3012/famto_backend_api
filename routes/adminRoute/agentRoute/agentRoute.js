const express = require("express");
const {
  addAgentByAdminController,
  editAgentByAdminController,
  getSingleAgentController,
  getRatingsByCustomerController,
  filterAgentsController,
  approveAgentRegistrationController,
  rejectAgentRegistrationController,
  blockAgentController,
  getAllAgentsController,
  searchAgentByNameController,
  getDeliveryAgentPayoutController,
  approvePaymentController,
  filterAgentPayoutController,
  changeAgentStatusController,
  searchAgentInPayoutController,
} = require("../../../controllers/admin/agent/agentController");
const { upload } = require("../../../utils/imageOperation");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const {
  addAgentByAdminValidations,
  editAgentByAdminValidations,
} = require("../../../middlewares/validators/agentValidation");

const adminAgentRoute = express.Router();

// Filter agent payout
adminAgentRoute.get(
  "/filter-payment",
  isAuthenticated,
  isAdmin,
  filterAgentPayoutController
);

// Search agent payout
adminAgentRoute.get(
  "/search-payout",
  isAuthenticated,
  isAdmin,
  searchAgentInPayoutController
);

// Get payout of agents
adminAgentRoute.get(
  "/get-agent-payout",
  isAuthenticated,
  isAdmin,
  getDeliveryAgentPayoutController
);

// Approve agent payout
adminAgentRoute.patch(
  "/approve-payout/:agentId/:detailId",
  isAuthenticated,
  isAdmin,
  approvePaymentController
);

// Add Agent by admin route
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

// Edit agent details by admin
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
  // editAgentByAdminValidations,
  isAuthenticated,
  isAdmin,
  editAgentByAdminController
);

// Get Agent by vehicle type
adminAgentRoute.get(
  "/filter",
  isAuthenticated,
  isAdmin,
  filterAgentsController
);

// Get all agents
adminAgentRoute.get(
  "/all-agents",
  isAuthenticated,
  isAdmin,
  getAllAgentsController
);

// Search agent
adminAgentRoute.get(
  "/search",
  isAuthenticated,
  isAdmin,
  searchAgentByNameController
);

// Change agent status
adminAgentRoute.patch(
  "/change-status/:agentId",
  isAuthenticated,
  isAdmin,
  changeAgentStatusController
);

// Approve registration
adminAgentRoute.patch(
  "/approve-registration/:agentId",
  isAuthenticated,
  isAdmin,
  approveAgentRegistrationController
);

// Decline registration
adminAgentRoute.delete(
  "/reject-registration/:agentId",
  isAuthenticated,
  isAdmin,
  rejectAgentRegistrationController
);

// Get ratings of agent by customer
adminAgentRoute.get(
  "/:agentId/get-ratings-by-customer",
  isAuthenticated,
  isAdmin,
  getRatingsByCustomerController
);

// Get single agent
adminAgentRoute.get(
  "/:agentId",
  isAuthenticated,
  isAdmin,
  getSingleAgentController
);

// Block agent
adminAgentRoute.patch(
  "/block-agent/:agentId",
  isAuthenticated,
  isAdmin,
  blockAgentController
);

module.exports = adminAgentRoute;
