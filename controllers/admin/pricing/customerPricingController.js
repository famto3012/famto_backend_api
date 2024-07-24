const { validationResult } = require("express-validator");
const appError = require("../../../utils/appError");
const CustomerPricing = require("../../../models/CustomerPricing");

const addCustomerPricingController = async (req, res, next) => {
  const {
    orderType,
    ruleName,
    baseFare,
    baseDistance,
    fareAfterBaseDistance,
    baseWeightUpto,
    fareAfterBaseWeight,
    purchaseFarePerHour,
    waitingFare,
    waitingTime,
    geofenceId,
    vehicleType,
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
      .replace(/\b\w/g, (char) => char.toUpperCase());

    const newRule = await CustomerPricing.create({
      orderType,
      ruleName: normalizedRuleName,
      baseFare,
      baseDistance,
      fareAfterBaseDistance,
      baseWeightUpto,
      fareAfterBaseWeight,
      purchaseFarePerHour,
      waitingFare,
      waitingTime,
      geofenceId,
      vehicleType,
    });

    if (!newRule) {
      return next(appError("Error in creating new rule"));
    }

    res.status(201).json({
      message: `${normalizedRuleName} created successfully`,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAllCustomerPricingController = async (req, res, next) => {
  try {
    const allCustomerPricings = await CustomerPricing.find({}).populate(
      "geofenceId",
      "name"
    );

    res.status(200).json({
      message: "All customer pricings",
      data: allCustomerPricings,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getSingleCustomerPricingController = async (req, res, next) => {
  try {
    const customerPricingFound = await CustomerPricing.findById(
      req.params.customerPricingId
    ).populate("geofenceId", "name");

    if (!customerPricingFound) {
      return next(appError("Customer pricing not found", 404));
    }

    res.status(200).json({
      message: "Single customer pricing",
      data: customerPricingFound,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const editCustomerPricingController = async (req, res, next) => {
  const {
    orderType,
    ruleName,
    baseFare,
    baseDistance,
    fareAfterBaseDistance,
    baseWeightUpto,
    fareAfterBaseWeight,
    purchaseFarePerHour,
    waitingFare,
    waitingTime,
    geofenceId,
    vehicleType,
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
    const customerPricingFound = await CustomerPricing.findById(
      req.params.customerPricingId
    );

    if (!customerPricingFound) {
      return next(appError("Customer pricing not found", 404));
    }

    const normalizedRuleName = ruleName
      .trim()
      .replace(/\s+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());

    const ruleNameFound = await CustomerPricing.findOne({
      ruleName: new RegExp(`^${normalizedRuleName}$`, "i"),
    });

    if (ruleNameFound) {
      formattedErrors.ruleName = "Rule name already exists for the order type";
      return res.status(409).json({ errors: formattedErrors });
    }

    const updatedCustomerPricing = await CustomerPricing.findByIdAndUpdate(
      req.params.customerPricingId,
      {
        orderType,
        ruleName: normalizedRuleName,
        baseFare,
        baseDistance,
        fareAfterBaseDistance,
        baseWeightUpto,
        fareAfterBaseWeight,
        purchaseFarePerHour,
        waitingFare,
        waitingTime,
        geofenceId,
        vehicleType,
      },
      { new: true }
    );

    if (!updatedCustomerPricing) {
      return next(appError("Error in updating customer pricing"));
    }

    res.status(200).json({
      message: `${normalizedRuleName} updated successfully`,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const deleteCustomerPricingController = async (req, res, next) => {
  try {
    const customerPricingFound = await CustomerPricing.findById(
      req.params.customerPricingId
    );

    if (!customerPricingFound) {
      return next(appError("Customer pricing not found", 404));
    }

    await CustomerPricing.findByIdAndDelete(req.params.customerPricingId);

    res.status(200).json({ message: "Rule deleted successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

const changeStatusCustomerPricingController = async (req, res, next) => {
  try {
    const customerPricingFound = await CustomerPricing.findById(
      req.params.customerPricingId
    );

    if (!customerPricingFound) {
      return next(appError("Customer pricing not found", 404));
    }

    // Toggle the status
    customerPricingFound.status = !customerPricingFound.status;
    await customerPricingFound.save();

    res
      .status(200)
      .json({ message: "Customer pricing status updated successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  addCustomerPricingController,
  getAllCustomerPricingController,
  getSingleCustomerPricingController,
  editCustomerPricingController,
  deleteCustomerPricingController,
  changeStatusCustomerPricingController,
};
