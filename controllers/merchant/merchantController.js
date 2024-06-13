const { validationResult } = require("express-validator");

const appError = require("../../utils/appError");
const {
  uploadToFirebase,
  deleteFromFirebase,
} = require("../../utils/imageOperation");
const MerchantDetails = require("../../models/MerchantDetail");

const addMerchantController = async (req, res, next) => {
  const {
    merchantId,
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
    availability,
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

    if (req.files) {
      const {
        merchantImage,
        pancardImage,
        GSTINImage,
        FSSAIImage,
        aadharImage,
      } = req.files;

      if (merchantImage) {
        merchantImageURL = await uploadToFirebase(
          merchantImage[0],
          "merchantImages"
        );
      }
      if (pancardImage) {
        pancardImageURL = await uploadToFirebase(
          pancardImage[0],
          "PancardImages"
        );
      }
      if (GSTINImage) {
        GSTINImageURL = await uploadToFirebase(GSTINImage[0], "GSTINImages");
      }
      if (FSSAIImage) {
        FSSAIImageURL = await uploadToFirebase(FSSAIImage[0], "FSSAIImages");
      }
      if (aadharImage) {
        aadharImageURL = await uploadToFirebase(aadharImage[0], "AadharImages");
      }
    }

    const newMerchant = await MerchantDetails.create({
      merchantId,
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
      availability,
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

const editMerchantController = async (req, res, next) => {
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
    availability,
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
    const merchantToUpdate = await MerchantDetails.findById(
      req.params.merchantId
    );

    if (!merchantToUpdate) {
      return next(appError("Merchant not found", 404));
    }

    let merchantImageURL = merchantToUpdate.merchantImageURL;
    let pancardImageURL = merchantToUpdate.pancardImageURL;
    let GSTINImageURL = merchantToUpdate.GSTINImageURL;
    let FSSAIImageURL = merchantToUpdate.FSSAIImageURL;
    let aadharImageURL = merchantToUpdate.aadharImageURL;

    // Check for changes in images
    if (req.files && req.files.merchantImage) {
      // Delete old merchant image
      await deleteFromFirebase(merchantToUpdate.merchantImageURL);
    }
    // Check for changes in images
    if (req.files && req.files.pancardImage) {
      // Delete old merchant image
      await deleteFromFirebase(merchantToUpdate.pancardImageURL);
    }
    // Check for changes in images
    if (req.files && req.files.GSTINImage) {
      // Delete old merchant image
      await deleteFromFirebase(merchantToUpdate.GSTINImageURL);
    }
    // Check for changes in images
    if (req.files && req.files.FSSAIImage) {
      // Delete old merchant image
      await deleteFromFirebase(merchantToUpdate.FSSAIImageURL);
    }
    // Check for changes in images
    if (req.files && req.files.aadharImage) {
      // Delete old merchant image
      await deleteFromFirebase(merchantToUpdate.aadharImageURL);
    }

    if (req?.files) {
      const {
        merchantImage,
        pancardImage,
        GSTINImage,
        FSSAIImage,
        aadharImage,
      } = req?.files;

      if (merchantImage) {
        merchantImageURL = await uploadToFirebase(
          merchantImage[0],
          "merchantImages"
        );
      }
      if (pancardImage) {
        pancardImageURL = await uploadToFirebase(
          pancardImage[0],
          "PancardImages"
        );
      }
      if (GSTINImage) {
        GSTINImageURL = await uploadToFirebase(GSTINImage[0], "GSTINImages");
      }
      if (FSSAIImage) {
        FSSAIImageURL = await uploadToFirebase(FSSAIImage[0], "FSSAIImages");
      }
      if (aadharImage) {
        aadharImageURL = await uploadToFirebase(aadharImage[0], "AadharImages");
      }
    }

    await MerchantDetails.findByIdAndUpdate(
      req.params.merchantId,
      {
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
        availability,
        username,
        email,
        phoneNumber,
      },
      {
        new: true,
      }
    );

    res.status(200).json({
      message: "Merchant updated successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = { addMerchantController, editMerchantController };
