const { validationResult } = require("express-validator");
const ServiceCategory = require("../../../models/ServiceCategory");
const appError = require("../../../utils/appError");
const {
  uploadToFirebase,
  deleteFromFirebase,
} = require("../../../utils/imageOperation");

const addServiceCategoryController = async (req, res, next) => {
  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const { title, geofenceId } = req.body;

    const lastCategory = await ServiceCategory.findOne().sort({
      order: -1,
    });
    const newOrder = lastCategory ? lastCategory.order + 1 : 1;

    let bannerImageURL = "";
    if (req.file) {
      bannerImageURL = await uploadToFirebase(
        req.file,
        "ServiceCategoryImages"
      );
    }

    const newServiceCategory = await ServiceCategory.create({
      title,
      geofenceId,
      bannerImageURL,
      order: newOrder,
    });

    if (!newServiceCategory) {
      return next(appError("Error in creating new Service category"));
    }

    res.status(200).json({
      message: "Service category added successfully",
      data: newServiceCategory,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const editServiceCategoryController = async (req, res, next) => {
  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const { id } = req.params;
    const { title, geofenceId } = req.body;

    const serviceCategory = await ServiceCategory.findById(id);
    if (!serviceCategory) {
      return next(appError("Service category not found"));
    }

    let bannerImageURL = serviceCategory.bannerImageURL;
    if (req.file) {
      await deleteFromFirebase(serviceCategory.bannerImageURL);
      bannerImageURL = await uploadToFirebase(
        req.file,
        "ServiceCategoryImages"
      );
    }

    serviceCategory.title = title || serviceCategory.title;
    serviceCategory.geofenceId = geofenceId || serviceCategory.geofenceId;
    serviceCategory.bannerImageURL = bannerImageURL;

    const updatedServiceCategory = await serviceCategory.save();

    if (!updatedServiceCategory) {
      return next(appError("Error in updating Service category"));
    }

    res.status(200).json({
      message: "Service category updated successfully",
      data: updatedServiceCategory,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAllServiceCategoriesController = async (req, res, next) => {
  try {
    const serviceCategories = await ServiceCategory.find().sort({ order: 1 });

    if (!serviceCategories) {
      return next(appError("No service categories found"));
    }

    res.status(200).json({
      message: "Service categories retrieved successfully",
      data: serviceCategories,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getServiceCategoryByIdController = async (req, res, next) => {
  try {
    const { id } = req.params;

    const serviceCategory = await ServiceCategory.findById(id);

    if (!serviceCategory) {
      return next(appError("Service category not found"));
    }

    res.status(200).json({
      message: "Service category retrieved successfully",
      data: serviceCategory,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const updateBusinessCategoryOrderController = async (req, res, next) => {
  const { categories } = req.body;

  try {
    for (const category of categories) {
      await ServiceCategory.findByIdAndUpdate(category.id, {
        order: category.order,
      });
    }

    res
      .status(200)
      .json({ message: "Service category order updated successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  addServiceCategoryController,
  editServiceCategoryController,
  getAllServiceCategoriesController,
  getServiceCategoryByIdController,
  updateBusinessCategoryOrderController,
};
