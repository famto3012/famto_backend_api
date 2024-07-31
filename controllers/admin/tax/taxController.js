const { validationResult } = require("express-validator");
const Tax = require("../../../models/Tax");
const appError = require("../../../utils/appError");

//Add tax
const addTaxController = async (req, res, next) => {
  const { taxName, tax, taxType, geofenceId, assignToBusinessCategoryId } =
    req.body;

  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const normalizedTaxName = taxName.trim();

    const taxNameFound = await Tax.findOne({
      taxName: normalizedTaxName,
      assignToBusinessCategoryId,
    });

    if (taxNameFound) {
      formattedErrors.taxName = "Tax name already exists";
      return res.status(409).json({ errors: formattedErrors });
    }

    const newTax = await Tax.create({
      taxName,
      tax,
      taxType,
      geofenceId,
      assignToBusinessCategoryId,
    });

    if (!newTax) {
      return next(appError("Error in creating new Tax"));
    }

    res.status(201).json({
      message: `${taxName} Tax created`,
      data: newTax,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

//Get All taxes
const getAllTaxController = async (req, res, next) => {
  try {
    const allTaxes = await Tax.find({})
      .populate("geofenceId", "name")
      .populate("assignToBusinessCategoryId", "title");

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
      .populate("assignToBusinessCategoryId", "title");

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
  const { taxName, tax, taxType, geofenceId, assignToBusinessCategoryId } =
    req.body;

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

    const normalizedTaxName = taxName.trim().replace(/\s+/g, "_").toLowerCase();
    const normalizedDbTaxName = taxFound.taxName
      .trim()
      .replace(/\s+/g, "_")
      .toLowerCase();

    if (normalizedTaxName !== normalizedDbTaxName) {
      const taxNameFound = await Tax.findOne({
        taxName: new RegExp(`^${normalizedTaxName}$`, "i"),
      });

      if (taxNameFound) {
        formattedErrors.taxName = "Tax name already exists";
        return res.status(409).json({ errors: formattedErrors });
      }
    }

    const updatedTax = await Tax.findByIdAndUpdate(
      req.params.taxId,
      {
        taxName,
        tax,
        taxType,
        geofenceId,
        assignToBusinessCategoryId,
      },
      { new: true }
    );

    if (!updatedTax) {
      return next(appError("Error in updating Tax"));
    }

    res.status(200).json({ message: `${taxName} is updated` });
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

    res.status(200).json({ message: "Tax deleted successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

//Disable / Enable Status
const disableOrEnableStatusController = async (req, res, next) => {
  try {
    const taxFound = await Tax.findById(req.params.taxId);

    if (!taxFound) {
      return next(appError("Tax not found", 404));
    }

    if (taxFound.status === true) {
      taxFound.status = false;
      await taxFound.save();
    } else {
      taxFound.status = true;
      await taxFound.save();
    }

    res.status(201).json({ message: `${taxFound.taxName} status updated` });
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
