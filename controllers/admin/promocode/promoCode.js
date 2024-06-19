const { validationResult } = require("express-validator");
const PromoCode = require("../../../models/PromoCode");
const appError = require("../../../utils/appError");

const addPromocodeController = async (req, res, next) => {
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
      promoName,
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
    } = req.body;

    // Create a new promocode object
    const newPromocode = new Promocode({
      promoName,
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

    // Save the promocode to the database
    const savedPromocode = await newPromocode.save();

    // Send a success response
    res.status(201).json({
      success: "Promocode created successfully",
      data: savedPromocode,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  addPromocodeController,
};
