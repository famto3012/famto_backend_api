const { validationResult } = require("express-validator");
const CustomerSurge = require("../../../models/CustomerSurge");
const appError = require("../../../utils/appError");

const addCustomerSurgeController = async (req, res, next) => {
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

    const ruleNameFound = await CustomerSurge.findOne({
      ruleName: new RegExp(`^${normalizedRuleName}$`, "i"),
    });

    if (ruleNameFound) {
      formattedErrors.ruleName = "Rule name already exists";
      return res.status(409).json({ errors: formattedErrors });
    }

    const newRule = await CustomerSurge.create({
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

    res.status(201).json({ message: `${ruleName} created successfully` });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAllCustomerSurgeController = async (req, res, next) => {
  try {
    const allCustomerSurges = await CustomerSurge.find({}).populate(
      "geofenceId",
      "name"
    );

    res.status(200).json({
      message: "All customer surge",
      data: allCustomerSurges,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getSingleCustomerSurgeController = async (req, res, next) => {
  try {
    const customerSurgeFound = await CustomerSurge.findById(
      req.params.customerSurgeId
    ).populate("geofenceId", "name");

    if (!customerSurgeFound) {
      return next(appError("Customer surge not found", 404));
    }

    res.status(200).json({
      message: "Single customer surge",
      data: customerSurgeFound,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const editCustomerSurgeController = async (req, res, next) => {
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
    const customerSurgeFound = await CustomerSurge.findById(
      req.params.customerSurgeId
    );

    if (!customerSurgeFound) {
      return next(appError("Merchant surge not found", 404));
    }

    const normalizedRuleName = ruleName
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
    const normalizedDBRuleName = customerSurgeFound.ruleName
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

    if (normalizedRuleName !== normalizedDBRuleName) {
      const ruleNameFound = await CustomerSurge.findOne({
        ruleName: new RegExp(`^${normalizedRuleName}$`, "i"),
      });

      if (ruleNameFound) {
        formattedErrors.ruleName = "Rule name already exists";
        return res.status(409).json({ errors: formattedErrors });
      }
    }

    const updatedCustomerSurge = await CustomerSurge.findByIdAndUpdate(
      req.params.customerSurgeId,
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

    if (!updatedCustomerSurge) {
      return next(appError("Error in updating customer surge"));
    }

    res.status(200).json({ message: `${ruleName} updated successfully` });
  } catch (err) {
    next(appError(err.message));
  }
};

const deleteCustomerSurgeController = async (req, res, next) => {
  try {
    const customerSurgeFound = await CustomerSurge.findById(
      req.params.customerSurgeId
    );

    if (!customerSurgeFound) {
      return next(appError("Customer surge not found", 404));
    }

    await CustomerSurge.findByIdAndDelete(req.params.customerSurgeId);

    res.status(200).json({ message: "Rule deleted successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

const changeStatusCustomerSurgeController = async (req, res, next) => {
  try {
    const customerSurgeFound = await CustomerSurge.findById(
      req.params.customerSurgeId
    );

    if (!customerSurgeFound) {
      return next(appError("Customer surge not found", 404));
    }

    // Toggle the status
    customerSurgeFound.status = !customerSurgeFound.status;
    await customerSurgeFound.save();

    res
      .status(200)
      .json({ message: "Customer surge status updated successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  addCustomerSurgeController,
  getAllCustomerSurgeController,
  getSingleCustomerSurgeController,
  editCustomerSurgeController,
  deleteCustomerSurgeController,
  changeStatusCustomerSurgeController,
};
