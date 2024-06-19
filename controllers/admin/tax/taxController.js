const { validationResult } = require("express-validator");
const Tax = require("../../../models/Tax");
const appError = require("../../../utils/appError");

//Add tax
const addTaxController = async (req, res, next) => {
  const { taxName, tax, taxType, geofenceId, assignToMerchantId } = req.body;

  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const normalizedTaxName = taxName.toLowerCase();

    const taxNameFound = await Tax.findOne({ taxName: normalizedTaxName });

    if (taxNameFound) {
      formattedErrors.taxName = "Tax name already exists";
      return res.status(409).json({ errors: formattedErrors });
    }

    const newTax = await Tax.create({
      taxName: normalizedTaxName,
      tax,
      taxType,
      geofenceId,
      assignToMerchantId,
    });

    if (!newTax) {
      return next(appError("Error in creating new Tax"));
    }

    res.status(201).json({ message: `${taxName} Tax created` });
  } catch (err) {
    next(appError(err.message));
  }
};

//Get All taxes
const getAllTaxController = async (req, res, next) => {
  try {
    const allTaxes = await Tax.find({})
      .populate("geofenceId", "name")
      .populate("assignToMerchantId", "fullName");

    res.status(200).json({
      message: "All taxes",
      data: allTaxes,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

//Get single Tax
const getSinglTaxController = async (req, res, next) => {
  try {
    const taxFound = await Tax.findById(req.params.taxId)
      .populate("geofenceId", "name")
      .populate("assignToMerchantId", "fullName");

    if (!taxFound) {
      return next(appError("Tax not found", 404));
    }

    res.status(200).json({
      message: "Single tax",
      data: taxFound,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

//Edit tax
const editTaxController = async (req, res, next) => {
  const { taxName, tax, taxType, geofenceId, assignToMerchantId } = req.body;

  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const taxFound = await Tax.findById(req.params.taxId);

    if (!taxFound) {
      return next(appError("Tax not found", 404));
    }

    const normalizedTaxName = taxName.toLowerCase();

    if (normalizedTaxName === taxFound.taxName) {
      formattedErrors.taxName = "Tax name already exists";
      return res.status(409).json({ errors: formattedErrors });
    }

    const updatedTax = await Tax.findByIdAndUpdate(
      req.params.taxId,
      {
        taxName: normalizedTaxName,
        tax,
        taxType,
        geofenceId,
        assignToMerchantId,
      },
      { new: true }
    );

    if (!updatedTax) {
      return next(appError("Error in updating Tax"));
    }

    res.status(201).json({ message: `${taxName} is updated` });
  } catch (err) {
    next(appError(err.message));
  }
};

//Delete tax
const deleteTaxController = async (req, res, next) => {
  try {
    const taxFound = await Tax.findById(req.params.taxId);

    if (!taxFound) {
      return next(appError("Tax not found", 404));
    }

    await Tax.findByIdAndDelete(req.params.taxId);

    req.status(200).json({ message: "Tax deleted successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

//Disable / Enable Status
const disableOrEnableStatusController = async (req, res, next) => {
  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const { status } = req.body;

    const taxFound = await Tax.findById(req.params.taxId);

    if (!taxFound) {
      return next(appError("Tax not found", 404));
    }

    const updatedTax = await Tax.findByIdAndUpdate(
      req.params.taxId,
      {
        status,
      },
      { new: true }
    );

    if (!updatedTax) {
      return next(appError("Error in updating Tax"));
    }

    res.status(201).json({ message: `${taxName} status updated` });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  addTaxController,
  getAllTaxController,
  getSinglTaxController,
  editTaxController,
  deleteTaxController,
  disableOrEnableStatusController,
};
