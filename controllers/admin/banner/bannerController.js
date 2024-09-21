const { validationResult } = require("express-validator");

const Banner = require("../../../models/Banner");

const {
  uploadToFirebase,
  deleteFromFirebase,
} = require("../../../utils/imageOperation");
const appError = require("../../../utils/appError");

const addBannerController = async (req, res, next) => {
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
      imageUrl = await uploadToFirebase(req.file, "AdBannerImages");
    }

    let newBanner = await Banner.create({
      name,
      geofenceId,
      imageUrl,
      merchantId,
    });

    newBanner = await newBanner.populate("geofenceId", "name");

    res.status(201).json({
      success: "Banner created successfully",
      data: newBanner,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const editBannerController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, merchantId, geofenceId } = req.body;

    const banner = await Banner.findById(id);

    // Check if the banner was found and updated
    if (!banner) {
      return next(appError("Banner not found", 404));
    }

    let imageUrl = banner.imageUrl;

    if (req.file) {
      if (imageUrl) {
        await deleteFromFirebase(banner.imageUrl);
      }
      imageUrl = await uploadToFirebase(req.file, "AdBannerImages");
    }

    // Find the banner by ID and update it with the new data
    let updatedBanner = await Banner.findByIdAndUpdate(
      id,
      {
        name,
        imageUrl, // Only update imageUrl if a new file is uploaded
        merchantId,
        geofenceId,
      },
      { new: true } // Return the updated document
    );

    updatedBanner = await updatedBanner.populate("geofenceId", "name");

    const formattedResponse = {
      _id: updatedBanner?._id,
      name: updatedBanner?.name || "-",
      imageUrl: updatedBanner?.imageUrl || "-",
      merchantId: updatedBanner?.merchantId || "-",
      geofenceId: updatedBanner?.geofenceId?.name || "-",
      status: updatedBanner?.status || null,
    };

    res.status(200).json({
      message: "Banner updated successfully!",
      banner: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAllBannersController = async (req, res, next) => {
  try {
    const banners = await Banner.find({}).populate("geofenceId", "name");

    const formattedResponse = banners?.map((banner) => {
      return {
        _id: banner?._id,
        name: banner?.name || "-",
        imageUrl: banner?.imageUrl || "-",
        merchantId: banner?.merchantId || "-",
        geofenceId: banner?.geofenceId?.name || "-",
        status: banner?.status || null,
      };
    });

    res.status(200).json({
      success: true,
      data: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getBannerByIdController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const banners = await Banner.findOne({ _id: id });

    if (!banners) {
      return next(appError("No banner found", 404));
    }

    res.status(200).json({
      success: true,
      data: banners,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const deleteBannerController = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Find the banner by ID and delete it
    const deletedBanner = await Banner.findById(id);

    // Check if the banner was found and deleted
    if (!deletedBanner) {
      return next(appError("Banner not found", 404));
    } else {
      await deleteFromFirebase(deletedBanner.imageUrl);
      await Banner.findByIdAndDelete(id);
    }

    res.status(200).json({
      success: true,
      message: "Banner deleted successfully!",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const updateStatusBannerController = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Find the banner by ID and delete it
    const updateBanner = await Banner.findById(id);

    // Check if the banner was found and deleted
    if (!updateBanner) {
      return next(appError("Banner not found", 404));
    }

    updateBanner.status = !updateBanner.status;

    await updateBanner.save();

    res.status(200).json({
      success: true,
      message: "Banner status updated successfully!",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  addBannerController,
  editBannerController,
  getAllBannersController,
  getBannerByIdController,
  deleteBannerController,
  updateStatusBannerController,
};
