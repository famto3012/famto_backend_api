const { validationResult } = require("express-validator");
const AppBanner = require("../../../models/AppBanner");
const {
  uploadToFirebase,
  deleteFromFirebase,
} = require("../../../utils/imageOperation");
const appError = require("../../../utils/appError");

const addAppBannerController = async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    let formattedErrors = {};
    errors.array().forEach((error) => {
      formattedErrors[error.param] = error.msg;
    });
    return res.status(400).json({ errors: formattedErrors });
  }

  try {
    const { name, merchantId, geofenceId } = req.body;

    let imageUrl = "";
    if (req.file) {
      imageUrl = await uploadToFirebase(req.file, "AppBannerImages");
    }

    let newAppBanner = new AppBanner({
      name,
      geofenceId,
      imageUrl,
      merchantId,
    });

    newAppBanner = await newAppBanner.populate("geofenceId", "name");

    res.status(201).json({
      success: "App Banner created successfully",
      data: newAppBanner,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const editAppBannerController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, merchantId, geofenceId } = req.body;

    const appBanner = await AppBanner.findOne({ _id: id });

    let imageUrl = appBanner.imageUrl;
    if (req.file) {
      await deleteFromFirebase(appBanner.imageUrl);
      imageUrl = await uploadToFirebase(req.file, "AppBannerImages");
    }

    // Find the banner by ID and update it with the new data
    let updatedAppBanner = await AppBanner.findByIdAndUpdate(
      id,
      {
        name,
        imageUrl, // Only update imageUrl if a new file is uploaded
        merchantId,
        geofenceId,
      },
      { new: true } // Return the updated document
    );

    // Check if the banner was found and updated
    if (!updatedAppBanner) {
      return next(appError("App Banner not found", 404));
    }

    updatedAppBanner = await updatedAppBanner.populate("geofenceId", "name");

    res.status(200).json({
      message: "App Banner updated successfully!",
      data: updatedAppBanner,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAllAppBannersController = async (req, res, next) => {
  try {
    const appBanners = await AppBanner.find().populate("geofenceId", "name");

    if (!appBanners) {
      return next(appError("No app banners found", 404));
    }

    res.status(200).json({
      success: true,
      data: appBanners,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAppBannerByIdController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const appBanners = await AppBanner.findOne({ _id: id });

    if (!appBanners) {
      return next(appError("No app banners found", 404));
    }

    res.status(200).json({
      success: true,
      data: appBanners,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const deleteAppBannerController = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Find the banner by ID and delete it
    const deletedAppBanner = await AppBanner.findOne({ _id: id });

    // Check if the banner was found and deleted
    if (!deletedAppBanner) {
      return next(appError("App Banner not found", 404));
    } else {
      await deleteFromFirebase(deletedAppBanner.imageUrl);
      await AppBanner.findByIdAndDelete(id);
    }

    res.status(200).json({
      success: true,
      message: "App Banner deleted successfully!",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const updateStatusAppBannerController = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Find the banner by ID and delete it
    const updateAppBanner = await AppBanner.findOne({ _id: id });

    // Check if the banner was found and deleted
    if (!updateAppBanner) {
      return next(appError("App Banner not found", 404));
    } else if (updateAppBanner.status) {
      updateAppBanner.status = false;
    } else {
      updateAppBanner.status = true;
    }

    await updateAppBanner.save();

    res.status(200).json({
      success: true,
      message: "App Banner status updated successfully!",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  addAppBannerController,
  editAppBannerController,
  getAllAppBannersController,
  getAppBannerByIdController,
  deleteAppBannerController,
  updateStatusAppBannerController,
};
