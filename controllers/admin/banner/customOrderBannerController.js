const { validationResult } = require("express-validator");
const CustomOrderBanner = require("../../../models/CustomOrderBanner");
const {
  uploadToFirebase,
  deleteFromFirebase,
} = require("../../../utils/imageOperation");
const appError = require("../../../utils/appError");

const addCustomOrderBannerController = async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    let formattedErrors = {};
    errors.array().forEach((error) => {
      formattedErrors[error.param] = error.msg;
    });
    return res.status(400).json({ errors: formattedErrors });
  }

  try {
    const { title, description } = req.body;

    let imageUrl = "";
    if (req.file) {
      imageUrl = await uploadToFirebase(req.file, "CustomOrderBannerImages");
    }

    const newCustomOrderBanner = new CustomOrderBanner({
      title,
      description,
      imageUrl,
    });

    const savedBanner = await newCustomOrderBanner.save();

    res.status(201).json({
      success: "Custom order Banner created successfully",
      data: savedBanner,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const editCustomOrderBannerController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;

    const banner = await CustomOrderBanner.findOne({ _id: id });

    let imageUrl = banner.imageUrl;
    if (req.file) {
      await deleteFromFirebase(banner.imageUrl);
      imageUrl = await uploadToFirebase(req.file, "CustomOrderBannerImages");
    }

    // Find the banner by ID and update it with the new data
    const updatedBanner = await CustomOrderBanner.findByIdAndUpdate(
      id,
      {
        title,
        description,
        imageUrl, // Only update imageUrl if a new file is uploaded
      },
      { new: true } // Return the updated document
    );

    // Check if the banner was found and updated
    if (!updatedBanner) {
      return next(appError("Custom order Banner not found", 404));
    }

    res.status(200).json({
      message: "Custom order Banner updated successfully!",
      banner: updatedBanner,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAllCustomOrderBannersController = async (req, res, next) => {
  try {
    const banners = await CustomOrderBanner.find();

    if (!banners) {
      return next(appError("No custom order banners found", 404));
    }

    res.status(200).json({
      success: true,
      data: banners,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getCustomOrderBannerByIdController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const banners = await CustomOrderBanner.findOne({ _id: id });

    if (!banners) {
      return next(appError("No custom order banners found", 404));
    }

    res.status(200).json({
      success: true,
      data: banners,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const deleteCustomOrderBannerController = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Find the banner by ID and delete it
    const deletedBanner = await CustomOrderBanner.findOne({ _id: id });

    // Check if the banner was found and deleted
    if (!deletedBanner) {
      return next(appError("PCustom order Banner not found", 404));
    } else {
      await deleteFromFirebase(deletedBanner.imageUrl);
      await CustomOrderBanner.findByIdAndDelete(id);
    }

    res.status(200).json({
      success: true,
      message: "Custom order Banner deleted successfully!",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const updateStatusCustomOrderBannerController = async (req, res, next) => {
  try {
    // Find the banner by ID and delete it
    const updateBanner = await CustomOrderBanner.find();

    const updatedBanner = await Promise.all(
      updateBanner.map(async (Banner) => {
        if (Banner.status === true) {
          Banner.status = false;
          await Banner.save();
        } else {
          Banner.status = true;
          await Banner.save();
        }
        return Banner;
      })
    );

    res.status(200).json({
      success: true,
      message: "Custom order Banner status updated successfully!",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  addCustomOrderBannerController,
  editCustomOrderBannerController,
  getAllCustomOrderBannersController,
  getCustomOrderBannerByIdController,
  deleteCustomOrderBannerController,
  updateStatusCustomOrderBannerController,
};
