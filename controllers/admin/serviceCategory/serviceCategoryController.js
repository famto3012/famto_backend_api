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
      console.log(req.file);
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

    if (!newServiceCategory)
      return next(appError("Error in creating new Service category"));

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
    const { serviceId } = req.params;
    const { title, geofenceId } = req.body;

    const service = await ServiceCategory.findById(serviceId);
    if (!service) return next(appError("Service category not found", 404));

    let bannerImageURL = service?.bannerImageURL;
    if (req.file) {
      if (bannerImageURL) {
        await deleteFromFirebase(service.bannerImageURL);
      }

      bannerImageURL = await uploadToFirebase(
        req.file,
        "ServiceCategoryImages"
      );
    }

    service.title = title || service.title;
    service.geofenceId = geofenceId || service.geofenceId;
    service.bannerImageURL = bannerImageURL;

    const updatedServiceCategory = await service.save();

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
    const services = await ServiceCategory.find({}).sort({ order: 1 });

    const formattedResponse = services?.map((service) => ({
      serviceId: service._id,
      title: service.title,
      bannerImage: service.bannerImageURL,
    }));

    res.status(200).json(formattedResponse);
  } catch (err) {
    next(appError(err.message));
  }
};

const getServiceCategoryByIdController = async (req, res, next) => {
  try {
    const { id } = req.params;

    const service = await ServiceCategory.findById(id);

    if (!service) return next(appError("Service category not found", 404));

    const formattedResponse = {
      serviceId: service.serviceId || null,
      title: service.title || null,
      geofenceId: service.geofenceId || null,
      bannerImage: service.bannerImageURL || null,
    };

    res.status(200).json(formattedResponse);
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

    res.status(200).json({
      message: "Service category order updated successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const deleteServiceCategoryController = async (req, res, next) => {
  try {
    const { id } = req.params;

    const service = await ServiceCategory.findById(id);

    if (!service) return next(appError("Service not found", 404));

    if (service?.bannerImageURL)
      await deleteFromFirebase(service.bannerImageURL);

    await ServiceCategory.findByIdAndDelete(id);

    res.status(200).json({
      message: "Service deleted successfully",
    });
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
  deleteServiceCategoryController,
};
