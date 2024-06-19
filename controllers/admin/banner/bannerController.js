const { validationResult } = require("express-validator");
const Banner = require("../../../models/Banner");
const {
  uploadToFirebase,
  deleteFromFirebase,
} = require("../../../utils/imageOperation");
const appError = require("../../../utils/appError");

const addBannerController = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    let formattedErrors = {};
    errors.array().forEach((error) => {
      formattedErrors[error.param] = error.msg;
    });
    return res.status(400).json({ errors: formattedErrors });
  }

  try {
    const { name, merchantId, geofence } = req.body;

    let imageUrl = "";
    if (req.file) {
      imageUrl = await uploadToFirebase(req.file, "AdBannerImages");
    }

    const newBanner = new Banner({
      name,
      geofence,
      imageUrl,
      merchantId,
    });

    const savedBanner = await newBanner.save();

    res.status(201).json({
      success: "Banner created successfully",
      data: savedBanner,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const editBannerController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, merchantId, geofence } = req.body;

    const banner = await Banner.findOne({ _id: id });

    await deleteFromFirebase(banner.imageUrl);

    let imageUrl = "";
    if (req.file) {
      imageUrl = await uploadToFirebase(req.file, "AdBannerImages");
    }

    // Find the banner by ID and update it with the new data
    const updatedBanner = await Banner.findByIdAndUpdate(
      id,
      {
        name,
        imageUrl, // Only update imageUrl if a new file is uploaded
        merchantId,
        geofence,
      },
      { new: true } // Return the updated document
    );

    // Check if the banner was found and updated
    if (!updatedBanner) {
      return next(appError("Banner not found", 404));
    }

    res
      .status(200)
      .json({ message: "Banner updated successfully!", banner: updatedBanner });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = { addBannerController, editBannerController };
