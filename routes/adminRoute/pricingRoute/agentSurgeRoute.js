const express = require("express");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const {
  addAgentSurgeController,
  getAllAgentSurgeController,
  getSingleAgentSurgeController,
  editAgentSurgeController,
  deleteAgentSurgeController,
  changeStatusAgentSurgeController,
} = require("../../../controllers/admin/pricing/agentSurgeController");
const {
  surgeValidations,
} = require("../../../middlewares/validators/pricingValidations");
const agentSurgeRoute = express.Router();

//Add agent surge
agentSurgeRoute.post(
  "/add-agent-surge",
  surgeValidations,
  isAuthenticated,
  isAdmin,
  addAgentSurgeController
);

//Get all agent surge
agentSurgeRoute.get(
  "/get-all-agent-surge",
  isAuthenticated,
  isAdmin,
  getAllAgentSurgeController
);

//Get single agent surge
agentSurgeRoute.get(
  "/:agentSurgeId",
  isAuthenticated,
  isAdmin,
  getSingleAgentSurgeController
);

//Edit agent surge
agentSurgeRoute.put(
  "/edit-agent-surge/:agentSurgeId",
  surgeValidations,
  isAuthenticated,
  isAdmin,
  editAgentSurgeController
);

//Delete agent surge
agentSurgeRoute.delete(
  "/delete-agent-surge/:agentSurgeId",
  isAuthenticated,
  isAdmin,
  deleteAgentSurgeController
);

//Change agent surge status
agentSurgeRoute.post(
  "/change-status/:agentSurgeId",
  isAuthenticated,
  isAdmin,
  changeStatusAgentSurgeController
);

module.exports = agentSurgeRoute;
