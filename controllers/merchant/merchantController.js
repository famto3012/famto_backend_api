const { validationResult } = require("express-validator");

const appError = require("../../utils/appError");
const { uploadToFirebase } = require("../../utils/imageOperation");
const Merchant = require("../../models/MerchantDetail");

const addMerchantController = async (req, res, next) => {
  const {
    username,
    email,
    phoneNumber,
    merchantName,
    displayAddress,
    description,
    geofence,
    location,
    pricing,
    pancardNumber,
    GSTINNumber,
    FSSAINumber,
    aadharNumber,
    deliveryOption,
    deliveryTime,
    servingArea,
  } = req.body;

  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    let merchantImageURL = "";
    let pancardImageURL = "";
    let GSTINImageURL = "";
    let FSSAIImageURL = "";
    let aadharImageURL = "";

    const normalizedUsername = username.trim().toLowerCase().replace(/\s/g, "");
    const normalizedEmail = email.trim().toLowerCase().replace(/\s/g, "");
    const normalizedPhoneNumber = phoneNumber
      .trim()
      .toLowerCase()
      .replace(/\s/g, "");

    const existingMerchant = await Merchant.findOne({
      $or: [
        { username: normalizedUsername },
        { email: normalizedEmail },
        { phoneNumber: normalizedPhoneNumber },
      ],
    });

    if (existingMerchant) {
      formattedErrors.username = "Username already exists";
      formattedErrors.email = "Email already exists";
      formattedErrors.phoneNumber = "Phone number already exists";
      return res.status(409).json({ errors: formattedErrors });
    }

    if (req.file) {
      const {
        merchantImage,
        pancardImage,
        GSTINImage,
        FSSAIImage,
        aadharImage,
      } = req.file;

      merchantImageURL = await uploadToFirebase(
        merchantImage,
        "merchantImages"
      );
      pancardImageURL = await uploadToFirebase(pancardImage, "PancardImages");
      GSTINImageURL = await uploadToFirebase(GSTINImage, "GSTINImages");
      FSSAIImageURL = await uploadToFirebase(FSSAIImage, "FSSAIImages");
      aadharImageURL = await uploadToFirebase(aadharImage, "AadharImages");
    }

    const newMerchant = await Merchant.create({
      username,
      email,
      phoneNumber,
      merchantName,
      merchantImageURL,
      displayAddress,
      description,
      geofence,
      location,
      pricing,
      pancardNumber,
      GSTINNumber,
      FSSAINumber,
      aadharNumber,
      deliveryOption,
      deliveryTime,
      servingArea,
      pancardImageURL,
      GSTINImageURL,
      FSSAIImageURL,
      aadharImageURL,
    });

    if (!newMerchant) {
      return next(appError("Error in creating new merchant"));
    }

    res.status(200).json({
      message: "Merchant created successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const updateMerchantController = async (req, res, next) => {
  const {
    username,
    email,
    phoneNumber,
    merchantName,
    displayAddress,
    description,
    geofence,
    location,
    pricing,
    pancardNumber,
    GSTINNumber,
    FSSAINumber,
    aadharNumber,
    deliveryOption,
    deliveryTime,
    servingArea,
  } = req.body;

  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const merchantToUpdate = await Merchant.findById(req.params.merchantId);

    if (!merchantToUpdate) {
      return next(appError("Merchant not found", 404));
    }

    let merchantImageURL = merchantToUpdate.merchantImageURL;
    let pancardImageURL = merchantToUpdate.pancardImageURL;
    let GSTINImageURL = merchantToUpdate.GSTINImageURL;
    let FSSAIImageURL = merchantToUpdate.FSSAIImageURL;
    let aadharImageURL = merchantToUpdate.aadharImageURL;
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = { addMerchantController };
