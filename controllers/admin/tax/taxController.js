const { validationResult } = require("express-validator");
const Tax = require("../../../models/Tax");
const appError = require("../../../utils/appError");

//Add tax
const addTaxController = async (req, res, next) => {
  const { taxName, tax, taxType, geofences, assignToBusinessCategory } =
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
    const normalizedTaxName = taxName
      .trim()
      .replace(/\s+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());

    const taxNameFound = await Tax.findOne({
      taxName: normalizedTaxName,
      assignToBusinessCategory,
    });

    if (taxNameFound) {
      formattedErrors.taxName = "Tax name already exists";
      return res.status(409).json({ errors: formattedErrors });
    }

    let newTax = await Tax.create({
      taxName: normalizedTaxName,
      tax,
      taxType,
      geofences,
      assignToBusinessCategory,
    });

    if (!newTax) {
      return next(appError("Error in creating new Tax"));
    }

    newTax = await Tax.findById(newTax._id)
      .populate("geofences", "name")
      .populate("assignToBusinessCategory", "title");

    const formattedResponse = {
      taxId: newTax._id,
      taxName: newTax.taxName,
      tax: newTax.tax,
      taxType: newTax.taxType,
      geofences: newTax.geofences.map((geofence) => {
        return geofence.name;
      }),
      assignToBusinessCategory: newTax.assignToBusinessCategory.title,
      status: newTax.status,
    };

    res.status(201).json({
      message: `${normalizedTaxName} Tax created`,
      data: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get all tax
const getAllTaxController = async (req, res, next) => {
  try {
    const allTaxes = await Tax.find({})
      .populate({
        path: "geofences",
        select: "name",
      })
      .populate("assignToBusinessCategory", "title");

    const formattedResponse = allTaxes.map((tax) => {
      return {
        taxId: tax._id,
        taxName: tax.taxName,
        tax: tax.tax,
        taxType: tax.taxType,
        geofences: tax.geofences.map((geofence) => {
          return geofence.name;
        }),
        assignToBusinessCategory: tax.assignToBusinessCategory.title,
        status: tax.status,
      };
    });

    res.status(200).json({
      message: "All taxes",
      data: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

//Get single Tax
const getSinglTaxController = async (req, res, next) => {
  try {
    const taxFound = await Tax.findById(req.params.taxId);

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
  const { taxName, tax, taxType, geofences, assignToBusinessCategory } =
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
    const { taxId } = req.params;

    const taxFound = await Tax.findById(taxId);

    if (!taxFound) {
      return next(appError("Tax not found", 404));
    }

    const normalizedTaxName = taxName
      .trim()
      .replace(/\s+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());

    const taxNameFound = await Tax.findOne({
      _id: { $ne: taxId },
      taxName: new RegExp(`^${normalizedTaxName}$`, "i"),
    });

    if (taxNameFound) {
      formattedErrors.taxName = "Tax name already exists";
      return res.status(409).json({ errors: formattedErrors });
    }

    let updatedTax = await Tax.findByIdAndUpdate(
      taxId,
      {
        taxName: normalizedTaxName,
        tax,
        taxType,
        geofences,
        assignToBusinessCategory,
      },
      { new: true }
    );

    if (!updatedTax) {
      return next(appError("Error in updating Tax"));
    }

    updatedTax = await Tax.findById(updatedTax._id)
      .populate({
        path: "geofences",
        select: "name",
      })
      .populate("assignToBusinessCategory", "title");

    const formattedResponse = {
      taxId: updatedTax._id,
      taxName: updatedTax.taxName,
      tax: updatedTax.tax,
      taxType: updatedTax.taxType,
      geofences: updatedTax.geofences.map((geofence) => {
        return geofence.name;
      }),
      assignToBusinessCategory: updatedTax.assignToBusinessCategory.title,
      status: updatedTax.status,
    };

    res.status(200).json({
      message: `${normalizedTaxName} is updated successfully`,
      data: formattedResponse,
    });
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
