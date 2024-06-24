const { validationResult } = require("express-validator");
const PickAndDropBanner = require("../../../models/PickAndDropBanner");
const {
  uploadToFirebase,
  deleteFromFirebase,
} = require("../../../utils/imageOperation");
const appError = require("../../../utils/appError");

const addPickAndDropBannerController = async (req, res, next) => {
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
      imageUrl = await uploadToFirebase(req.file, "PickAndDropBannerImages");
    }

    const newPickAndDropBanner = new PickAndDropBanner({
      title,
      description,
      imageUrl,
    });

    const savedBanner = await newPickAndDropBanner.save();

    res.status(201).json({
      success: "Pick and drop Banner created successfully",
      data: savedBanner,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const editPickAndDropBannerController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;

    const banner = await PickAndDropBanner.findOne({ _id: id });

    let imageUrl = banner.imageUrl;
    if (req.file) {
      await deleteFromFirebase(banner.imageUrl);
      imageUrl = await uploadToFirebase(req.file, "PickAndDropBannerImages");
    }

    // Find the banner by ID and update it with the new data
    const updatedBanner = await PickAndDropBanner.findByIdAndUpdate(
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
      return next(appError("Pick and drop Banner not found", 404));
    }

    res
      .status(200)
      .json({
        message: "Pick and drop Banner updated successfully!",
        banner: updatedBanner,
      });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAllPickAndDropBannersController = async (req, res, next) => {
  try {
    const banners = await PickAndDropBanner.find();

    if (!banners) {
      return next(appError("No pick and drop banners found", 404));
    }

    res.status(200).json({
      success: true,
      data: banners,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getPickAndDropBannerByIdController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const banners = await PickAndDropBanner.findOne({ _id: id });

    if (!banners) {
      return next(appError("No pick and drop banners found", 404));
    }

    res.status(200).json({
      success: true,
      data: banners,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const deletePickAndDropBannerController = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Find the banner by ID and delete it
    const deletedBanner = await PickAndDropBanner.findOne({ _id: id });

    // Check if the banner was found and deleted
    if (!deletedBanner) {
      return next(appError("Pick and drop Banner not found", 404));
    } else {
      await deleteFromFirebase(deletedBanner.imageUrl);
      await PickAndDropBanner.findByIdAndDelete(id);
    }

    res.status(200).json({
      success: true,
      message: "Pick and drop Banner deleted successfully!",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const updateStatusPickAndDropBannerController = async (req, res, next) => {
  try {

    // Find the banner by ID and delete it
    const updateBanner = await PickAndDropBanner.find();

    const updatedBanner = await Promise.all(
        updateBanner.map(async (Banner) => {
          if (Banner.status === true) {
            Banner.status = false;
            await Banner.save();
          }else{
            Banner.status = true;
            await Banner.save();
          }
          return Banner;
        })
      );

    res.status(200).json({
      success: true,
      message: "Pick and drop Banner status updated successfully!",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  addPickAndDropBannerController,
  editPickAndDropBannerController,
  getAllPickAndDropBannersController,
  getPickAndDropBannerByIdController,
  deletePickAndDropBannerController,
  updateStatusPickAndDropBannerController,
};
