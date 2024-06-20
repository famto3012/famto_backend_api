const express = require("express");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const {
  addAgentPricingController,
  getAllAgentPricingController,
  getSingleAgentPricingController,
  editAgentPricingController,
  deleteAgentPricingController,
  changeStatusAgentPricingController,
} = require("../../../controllers/admin/pricing/agentPricingController");
const agentPricingRoute = express.Router();

//Add agent pricing
agentPricingRoute.post(
  "/add-agent-pricing",
  isAuthenticated,
  isAdmin,
  addAgentPricingController
);

//Get all agent pricing
agentPricingRoute.get(
  "/get-all-agent-pricing",
  isAuthenticated,
  isAdmin,
  getAllAgentPricingController
);

//Get single agent pricing
agentPricingRoute.get(
  "/:agentPricingId",
  isAuthenticated,
  isAdmin,
  getSingleAgentPricingController
);

//Edit agent pricing
agentPricingRoute.put(
  "/edit-agent-pricing/:agentPricingId",
  isAuthenticated,
  isAdmin,
  editAgentPricingController
);

//Delete agent pricing
agentPricingRoute.delete(
  "/delete-agent-pricing/:agentPricingId",
  isAuthenticated,
  isAdmin,
  deleteAgentPricingController
);

//Change agent pricing status
agentPricingRoute.post(
  "/change-status/:agentPricingId",
  isAuthenticated,
  isAdmin,
  changeStatusAgentPricingController
);

module.exports = agentPricingRoute;
