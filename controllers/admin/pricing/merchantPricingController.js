const { validationResult } = require("express-validator");
const MerchantPricing = require("../../../models/MerchantPricing");
const appError = require("../../../utils/appError");

const addMerchantPricingController = async (req, res, next) => {
  const {
    ruleName,
    baseFare,
    baseDistance,
    fareAfterBaseDistance,
    baseWeightUpTo,
    fareAfterBaseWeight,
    purchaseFarePerHour,
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

    const ruleNameFound = await MerchantPricing.findOne({
      ruleName: new RegExp(`^${normalizedRuleName}$`, "i"),
    });

    if (ruleNameFound) {
      formattedErrors.ruleName = "Rule name already exists";
      return res.status(409).json({ errors: formattedErrors });
    }

    const newRule = await MerchantPricing.create({
      ruleName,
      baseFare,
      baseDistance,
      fareAfterBaseDistance,
      baseWeightUpTo,
      fareAfterBaseWeight,
      purchaseFarePerHour,
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

const getAllMerchantPricingController = async (req, res, next) => {
  try {
    const allMerchantPricings = await MerchantPricing.find({}).populate(
      "geofenceId",
      "name"
    );

    res.status(200).json({
      message: "All merchant pricings",
      data: allMerchantPricings,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getSingleMerchantPricingController = async (req, res, next) => {
  try {
    const merchantPricingFound = await MerchantPricing.findById(
      req.params.merchantPricingId
    ).populate("geofenceId", "name");

    if (!merchantPricingFound) {
      return next(appError("Merchant pricing not found", 404));
    }

    res.status(200).json({
      message: "Single merchant pricing",
      data: merchantPricingFound,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const editMerchantPricingController = async (req, res, next) => {
  const {
    ruleName,
    baseFare,
    baseDistance,
    fareAfterBaseDistance,
    baseWeightUpTo,
    fareAfterBaseWeight,
    purchaseFarePerHour,
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
    const merchantPricingFound = await MerchantPricing.findById(
      req.params.merchantPricingId
    );

    if (!merchantPricingFound) {
      return next(appError("Merchant pricing not found", 404));
    }

    const normalizedRuleName = ruleName
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
    const normalizedDBRuleName = merchantPricingFound.ruleName
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

    if (normalizedRuleName !== normalizedDBRuleName) {
      const ruleNameFound = await MerchantPricing.findOne({
        ruleName: new RegExp(`^${normalizedRuleName}$`, "i"),
      });

      if (ruleNameFound) {
        formattedErrors.ruleName = "Rule name already exists";
        return res.status(409).json({ errors: formattedErrors });
      }
    }

    const updatedmerchantPricing = await MerchantPricing.findByIdAndUpdate(
      req.params.merchantPricingId,
      {
        ruleName,
        baseFare,
        baseDistance,
        fareAfterBaseDistance,
        baseWeightUpTo,
        fareAfterBaseWeight,
        purchaseFarePerHour,
        waitingFare,
        waitingTime,
        geofenceId,
      },
      { new: true }
    );

    if (!updatedmerchantPricing) {
      return next(appError("Error in updating merchant pricing"));
    }

    res.status(200).json({ message: `${ruleName} updated successfully` });
  } catch (err) {
    next(appError(err.message));
  }
};

const deleteMerchantPricingController = async (req, res, next) => {
  try {
    const merchantPricingFound = await MerchantPricing.findById(
      req.params.merchantPricingId
    );

    if (!merchantPricingFound) {
      return next(appError("Merchant pricing not found", 404));
    }

    await MerchantPricing.findByIdAndDelete(req.params.merchantPricingId);

    res.status(200).json({ message: "Rule deleted successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

const changeStatusMerchantPricingController = async (req, res, next) => {
  try {
    const merchantPricingFound = await MerchantPricing.findById(
      req.params.merchantPricingId
    );

    if (!merchantPricingFound) {
      return next(appError("Merchant pricing not found", 404));
    }

    // Toggle the status
    merchantPricingFound.status = !merchantPricingFound.status;
    await merchantPricingFound.save();

    res
      .status(200)
      .json({ message: "Merchant pricing status updated successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  addMerchantPricingController,
  getAllMerchantPricingController,
  getSingleMerchantPricingController,
  editMerchantPricingController,
  deleteMerchantPricingController,
  changeStatusMerchantPricingController,
};
