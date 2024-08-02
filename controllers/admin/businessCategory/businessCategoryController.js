const { validationResult } = require("express-validator");
const BusinessCategory = require("../../../models/BusinessCategory");
const appError = require("../../../utils/appError");
const {
  uploadToFirebase,
  deleteFromFirebase,
} = require("../../../utils/imageOperation");

const addBusinessCategoryController = async (req, res, next) => {
  const { title, geofenceId } = req.body;

  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    // Find the highest order number
    const lastCategory = await BusinessCategory.findOne().sort({
      order: -1,
    });

    const newOrder = lastCategory ? lastCategory.order + 1 : 1;

    let bannerImageURL = "";
    if (req.file) {
      bannerImageURL = await uploadToFirebase(
        req.file,
        "BusinessCategoryImages"
      );
    }

    const newBusinessCategory = await BusinessCategory.create({
      title,
      geofenceId,
      bannerImageURL,
      order: newOrder,
    });

    if (!newBusinessCategory) {
      return next(appError("Error in creating new Business category"));
    }

    res.status(200).json({ message: "Business category added successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAllBusinessCategoryController = async (req, res, next) => {
  try {
    const allBusinessCategories = await BusinessCategory.find({ status: true })
      .select("title status order bannerImageURL")
      .sort({ order: 1 });

    res.status(200).json({
      message: "All business categories",
      data: allBusinessCategories,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getSingleBusinessCategoryController = async (req, res, next) => {
  try {
    const businessCategory = await BusinessCategory.findById(
      req.params.businessCategoryId
    ).populate("geofenceId", "name");

    if (!businessCategory) {
      return next(appError("Business category not found", 404));
    }

    res.status(200).json({
      message: "Single business category",
      data: businessCategory,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const editBusinessCategoryController = async (req, res, next) => {
  const { title, geofenceId } = req.body;

  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const businessCategoryFound = await BusinessCategory.findById(
      req.params.businessCategoryId
    );

    if (!businessCategoryFound) {
      return next(appError("Business category not found", 404));
    }

    let bannerImageURL = businessCategoryFound.bannerImageURL;
    let order = businessCategoryFound.order;

    if (req.file) {
      await deleteFromFirebase(bannerImageURL);
      bannerImageURL = await uploadToFirebase(
        req.file,
        "BusinessCategoryImages"
      );
    }

    await BusinessCategory.findByIdAndUpdate(req.params.businessCategoryId, {
      title,
      geofenceId,
      bannerImageURL,
      order,
    });

    res.status(200).json({ message: "Business category updated successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

const deleteBusinessCategoryController = async (req, res, next) => {
  try {
    const businessCategoryFound = await BusinessCategory.findById(
      req.params.businessCategoryId
    );

    if (!businessCategoryFound) {
      return next(appError("Business category not found", 404));
    }

    let bannerImageURL = businessCategoryFound.bannerImageURL;
    await deleteFromFirebase(bannerImageURL);

    await BusinessCategory.findByIdAndDelete(req.params.businessCategoryId);

    res.status(200).json({ message: "Business category deleted successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

const enableOrDisableBusinessCategoryController = async (req, res, next) => {
  try {
    const businessCategoryFound = await BusinessCategory.findById(
      req.params.businessCategoryId
    );

    if (!businessCategoryFound) {
      return next(appError("Business category not found", 404));
    }

    // Toggle the status
    businessCategoryFound.status = !businessCategoryFound.status;
    await businessCategoryFound.save();

    res.status(200).json({ message: "Business category status updated" });
  } catch (err) {
    next(appError(err.message));
  }
};

const updateBusinessCategoryOrderController = async (req, res, next) => {
  const { categories } = req.body;

  try {
    for (const category of categories) {
      await BusinessCategory.findByIdAndUpdate(category.id, {
        order: category.order,
      });
    }

    res
      .status(200)
      .json({ message: "Business category order updated successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  addBusinessCategoryController,
  getAllBusinessCategoryController,
  getSingleBusinessCategoryController,
  editBusinessCategoryController,
  deleteBusinessCategoryController,
  enableOrDisableBusinessCategoryController,
  updateBusinessCategoryOrderController,
};
