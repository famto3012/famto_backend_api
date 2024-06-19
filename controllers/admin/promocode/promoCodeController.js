const { validationResult } = require("express-validator");
const PromoCode = require("../../../models/PromoCode");
const appError = require("../../../utils/appError");
const { uploadToFirebase, deleteFromFirebase } = require("../../../utils/imageOperation");

const addPromoCodeController = async (req, res, next) => {
  // Validate request body
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    let formattedErrors = {};
    errors.array().forEach((error) => {
      formattedErrors[error.param] = error.msg;
    });
    return res.status(400).json({ errors: formattedErrors });
  }

  try {
    const {
      promoCode,
      promoType,
      discount,
      description,
      fromDate,
      toDate,
      maxDiscountValue,
      minOrderAmount,
      maxAllowedUsers,
      appliedOn,
      merchantId,
      geofenceId,
    } = req.body;

    let imageUrl = "";
    if (req.file) {
      imageUrl = await uploadToFirebase(req.file, "PromoCodeImages");
    }

    // Create a new promocode object
    const newPromoCode = new PromoCode({
      promoCode,
      promoType,
      discount,
      description,
      fromDate,
      toDate,
      maxDiscountValue,
      minOrderAmount,
      maxAllowedUsers,
      appliedOn,
      merchantId,
      geofenceId,
      imageUrl
    });

 
    const savedPromoCode = await newPromoCode.save();

    // Send a success response
    res.status(201).json({
      success: "Promocode created successfully",
      data: savedPromoCode,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// const editPromoCodeController = async (req, res, next) => {
//   // Validate request body
//   const errors = validationResult(req);
//   if (!errors.isEmpty()) {
//     let formattedErrors = {};
//     errors.array().forEach((error) => {
//       formattedErrors[error.param] = error.msg;
//     });
//     return res.status(400).json({ errors: formattedErrors });
//   }

//   try {
//     const {
//       promoCode,
//       promoType,
//       discount,
//       description,
//       fromDate,
//       toDate,
//       maxDiscountValue,
//       minOrderAmount,
//       maxAllowedUsers,
//       appliedOn,
//       merchantId,
//       geofenceId,
//     } = req.body;

//     // Get the promo code ID from the request parameters
//     const { id } = req.params;

//     // Find the existing promo code by ID
//     let existingPromoCode = await PromoCode.findById(id);
//     if (!existingPromoCode) {
//       return res.status(404).json({ error: "Promocode not found" });
//     }

//     // Update image if a new file is provided
//     let imageUrl = existingPromoCode.imageUrl;
//     if (req.file) {
//       await deleteFromFirebase(imageUrl)
//       imageUrl = await uploadToFirebase(req.file, "PromoCodeImages");
//     }

//     // Update the promo code with new values
//     existingPromoCode.promoCode = promoCode;
//     existingPromoCode.promoType = promoType;
//     existingPromoCode.discount = discount;
//     existingPromoCode.description = description;
//     existingPromoCode.fromDate = fromDate;
//     existingPromoCode.toDate = toDate;
//     existingPromoCode.maxDiscountValue = maxDiscountValue;
//     existingPromoCode.minOrderAmount = minOrderAmount;
//     existingPromoCode.maxAllowedUsers = maxAllowedUsers;
//     existingPromoCode.appliedOn = appliedOn;
//     existingPromoCode.merchantId = merchantId;
//     existingPromoCode.geofenceId = geofenceId;
//     existingPromoCode.imageUrl = imageUrl;

//     // Save the updated promo code
//     const updatedPromoCode = await existingPromoCode.save();

//     // Send a success response
//     res.status(200).json({
//       success: "Promocode updated successfully",
//       data: updatedPromoCode,
//     });
//   } catch (err) {
//     next(appError(err.message));
//   }
// };

const editPromoCodeController = async (req, res, next) => {
  // Validate request body
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    let formattedErrors = {};
    errors.array().forEach((error) => {
      formattedErrors[error.param] = error.msg;
    });
    return res.status(400).json({ errors: formattedErrors });
  }

  try {
    // Get the promo code ID from the request parameters
    const { id } = req.params;

    // Find the existing promo code by ID
    let existingPromoCode = await PromoCode.findById(id);
    if (!existingPromoCode) {
      return res.status(404).json({ error: "Promocode not found" });
    }

    // Update image if a new file is provided
    let imageUrl = existingPromoCode.imageUrl;
        if (req.file) {
          await deleteFromFirebase(imageUrl)
         imageUrl = await uploadToFirebase(req.file, "PromoCodeImages");
        }

    // Update only the fields provided by the user
    const updateFields = [
      'promoCode',
      'promoType',
      'discount',
      'description',
      'fromDate',
      'toDate',
      'maxDiscountValue',
      'minOrderAmount',
      'maxAllowedUsers',
      'appliedOn',
      'merchantId',
      'geofenceId'
    ];

    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        existingPromoCode[field] = req.body[field];
      }
    });

    // If an image file was uploaded, update the imageUrl
    if (req.file) {
      existingPromoCode.imageUrl = imageUrl;
    }

    // Save the updated promo code
    const updatedPromoCode = await existingPromoCode.save();

    // Send a success response
    res.status(200).json({
      success: "Promocode updated successfully",
      data: updatedPromoCode,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAllPromoCodesController = async (req, res, next) => {
  try {
    // Fetch all promo codes from the database
    const promoCodes = await PromoCode.find();

    // Send a success response with the fetched promo codes
    res.status(200).json({
      success: "Promo codes retrieved successfully",
      data: promoCodes,
    });
  } catch (err) {
    // Pass the error to the error-handling middleware
    next(appError(err.message));
  }
};

const deletePromoCodeController = async (req, res, next) => {
  try {
    // Get the promo code ID from the request parameters
    const { id } = req.params;

    // Find the promo code by ID and delete it
    const deletedPromoCode = await PromoCode.findByIdAndDelete(id);

    // If no promo code is found, send a 404 response
    if (!deletedPromoCode) {
      return res.status(404).json({ error: "Promo code not found" });
    }

    // Send a success response
    res.status(200).json({
      success: "Promo code deleted successfully",
    });
  } catch (err) {
    // Pass the error to the error-handling middleware
    next(appError(err.message));
  }
};




module.exports = {
  addPromoCodeController,
  editPromoCodeController,
  deletePromoCodeController,
  getAllPromoCodesController
};
