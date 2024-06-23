const { validationResult } = require("express-validator");
const appError = require("../../../utils/appError");
const AgentPricing = require("../../../models/AgentPricing");

const addAgentPricingController = async (req, res, next) => {
  const {
    ruleName,
    baseFare,
    baseDistanceFare,
    extraFarePerDay,
    baseDistanceFarePerKM,
    waitingFare,
    waitingTime,
    purchaseFarePerHour,
    addedTip,
    geofenceId,
  } = req.body;

  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const normalizedRuleName = ruleName
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

    const ruleNameFound = await AgentPricing.findOne({
      ruleName: new RegExp(`^${normalizedRuleName}$`, "i"),
    });

    if (ruleNameFound) {
      formattedErrors.ruleName = "Rule name already exists";
      return res.status(409).json({ errors: formattedErrors });
    }

    const newRule = await AgentPricing.create({
      ruleName,
      baseFare,
      baseDistanceFare,
      extraFarePerDay,
      baseDistanceFarePerKM,
      waitingFare,
      waitingTime,
      purchaseFarePerHour,
      addedTip,
      geofenceId,
    });

    if (!newRule) {
      return next(appError("Error in creating new rule"));
    }

    res.status(201).json({ message: `${ruleName} created successfully` });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAllAgentPricingController = async (req, res, next) => {
  try {
    const allAgentPricings = await AgentPricing.find({}).populate(
      "geofenceId",
      "name"
    );

    res.status(200).json({
      message: "All agent pricings",
      data: allAgentPricings,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getSingleAgentPricingController = async (req, res, next) => {
  try {
    const agentPricingFound = await AgentPricing.findById(
      req.params.agentPricingId
    ).populate("geofenceId", "name");

    if (!agentPricingFound) {
      return next(appError("Agent pricing not found", 404));
    }

    res.status(200).json({
      message: "Single agent pricing",
      data: agentPricingFound,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const editAgentPricingController = async (req, res, next) => {
  const {
    ruleName,
    baseFare,
    baseDistanceFare,
    extraFarePerDay,
    baseDistanceFarePerKM,
    waitingFare,
    waitingTime,
    purchaseFarePerHour,
    addedTip,
    geofenceId,
  } = req.body;

  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const agentPricingFound = await AgentPricing.findById(
      req.params.agentPricingId
    ).populate("geofenceId", "name");

    if (!agentPricingFound) {
      return next(appError("Agent pricing not found", 404));
    }

    const normalizedRuleName = ruleName
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
    const normalizedDBRuleName = agentPricingFound.ruleName
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

    if (normalizedRuleName !== normalizedDBRuleName) {
      const ruleNameFound = await AgentPricing.findOne({
        ruleName: new RegExp(`^${normalizedRuleName}$`, "i"),
      });

      if (ruleNameFound) {
        formattedErrors.ruleName = "Rule name already exists";
        return res.status(409).json({ errors: formattedErrors });
      }
    }

    const updatedAgentPricing = await AgentPricing.findByIdAndUpdate(
      req.params.agentPricingId,
      {
        ruleName,
        baseFare,
        baseDistanceFare,
        extraFarePerDay,
        baseDistanceFarePerKM,
        waitingFare,
        waitingTime,
        purchaseFarePerHour,
        addedTip,
        geofenceId,
      },
      { new: true }
    );

    if (!updatedAgentPricing) {
      return next(appError("Error in updating agent pricing"));
    }

    res.status(200).json({ message: `${ruleName} updated successfully` });
  } catch (err) {
    next(appError(err.message));
  }
};

const deleteAgentPricingController = async (req, res, next) => {
  try {
    const agentPricingFound = await AgentPricing.findById(
      req.params.agentPricingId
    );

    if (!agentPricingFound) {
      return next(appError("Agent pricing not found", 404));
    }

    await AgentPricing.findByIdAndDelete(req.params.agentPricingId);

    res.status(200).json({ message: "Rule deleted successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

const changeStatusAgentPricingController = async (req, res, next) => {
  try {
    const agentPricingFound = await AgentPricing.findById(
      req.params.agentPricingId
    );

    if (!agentPricingFound) {
      return next(appError("Agent pricing not found", 404));
    }

    // Toggle the status
    agentPricingFound.status = !agentPricingFound.status;
    await agentPricingFound.save();

    res
      .status(200)
      .json({ message: "Agent pricing status updated successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  addAgentPricingController,
  getAllAgentPricingController,
  getSingleAgentPricingController,
  editAgentPricingController,
  deleteAgentPricingController,
  changeStatusAgentPricingController,
};
