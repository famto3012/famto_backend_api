const { validationResult } = require("express-validator");
const appError = require("../../../utils/appError");
const MerchantSurge = require("../../../models/MerchantSurge");

const addMerchantSurgeController = async (req, res, next) => {
  const {
    ruleName,
    baseFare,
    baseDistance,
    waitingFare,
    waitingTime,
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

    const ruleNameFound = await MerchantSurge.findOne({
      ruleName: new RegExp(`^${normalizedRuleName}$`, "i"),
    });

    if (ruleNameFound) {
      formattedErrors.ruleName = "Rule name already exists";
      return res.status(409).json({ errors: formattedErrors });
    }

    let newRule = await MerchantSurge.create({
      ruleName,
      baseFare,
      baseDistance,
      waitingFare,
      waitingTime,
      geofenceId,
    });

    if (!newRule) {
      return next(appError("Error in creating new rule"));
    }

    newRule = await newRule.populate("geofenceId", "name");

    res.status(201).json({
      message: `${normalizedRuleName} created successfully`,
      data: newRule,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAllMerchantSurgeController = async (req, res, next) => {
  try {
    const allMerchantSurges = await MerchantSurge.find({}).populate(
      "geofenceId",
      "name"
    );

    res.status(200).json({
      message: "All merchant surge",
      data: allMerchantSurges,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getSingleMerchantSurgeController = async (req, res, next) => {
  try {
    const merchantSurgeFound = await MerchantSurge.findById(
      req.params.merchantSurgeId
    ).populate("geofenceId", "name");

    if (!merchantSurgeFound) {
      return next(appError("Merchant surge not found", 404));
    }

    res.status(200).json({
      message: "Single merchant surge",
      data: merchantSurgeFound,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const editMerchantSurgeController = async (req, res, next) => {
  const {
    ruleName,
    baseFare,
    baseDistance,
    waitingFare,
    waitingTime,
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
    const merchantSurgeFound = await MerchantSurge.findById(
      req.params.merchantSurgeId
    );

    if (!merchantSurgeFound) {
      return next(appError("Merchant surge not found", 404));
    }

    const normalizedRuleName = ruleName
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
    const normalizedDBRuleName = merchantSurgeFound.ruleName
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

    if (normalizedRuleName !== normalizedDBRuleName) {
      const ruleNameFound = await MerchantSurge.findOne({
        ruleName: new RegExp(`^${normalizedRuleName}$`, "i"),
      });

      if (ruleNameFound) {
        formattedErrors.ruleName = "Rule name already exists";
        return res.status(409).json({ errors: formattedErrors });
      }
    }

    let updatedMerchantSurge = await MerchantSurge.findByIdAndUpdate(
      req.params.merchantSurgeId,
      {
        ruleName,
        baseFare,
        baseDistance,
        waitingFare,
        waitingTime,
        geofenceId,
      },
      { new: true }
    );

    if (!updatedMerchantSurge) {
      return next(appError("Error in updating merchant surge"));
    }

    updatedMerchantSurge = await updatedMerchantSurge.populate(
      "geofenceId",
      "name"
    );

    res.status(200).json({
      message: `${ruleName} updated successfully`,
      data: updatedMerchantSurge,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const deleteMerchantSurgeController = async (req, res, next) => {
  try {
    const merchantSurgeFound = await MerchantSurge.findById(
      req.params.merchantSurgeId
    );

    if (!merchantSurgeFound) {
      return next(appError("Merchant surge not found", 404));
    }

    await MerchantSurge.findByIdAndDelete(req.params.merchantSurgeId);

    res.status(200).json({ message: "Rule deleted successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

const changeStatusMerchantSurgeController = async (req, res, next) => {
  try {
    const merchantSurgeFound = await MerchantSurge.findById(
      req.params.merchantSurgeId
    );

    if (!merchantSurgeFound) {
      return next(appError("Merchant surge not found", 404));
    }

    // Toggle the status
    merchantSurgeFound.status = !merchantSurgeFound.status;
    await merchantSurgeFound.save();

    res.status(200).json({
      message: "Merchant surge status updated successfully",
      data: merchantSurgeFound.status,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  addMerchantSurgeController,
  getAllMerchantSurgeController,
  getSingleMerchantSurgeController,
  editMerchantSurgeController,
  deleteMerchantSurgeController,
  changeStatusMerchantSurgeController,
};
