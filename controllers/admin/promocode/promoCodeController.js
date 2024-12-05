const { validationResult } = require("express-validator");
const PromoCode = require("../../../models/PromoCode");
const appError = require("../../../utils/appError");
const {
  uploadToFirebase,
  deleteFromFirebase,
} = require("../../../utils/imageOperation");
const { formatDate } = require("../../../utils/formatters");

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
      applicationMode,
      merchantId,
      geofenceId,
      deliveryMode,
    } = req.body;

    let imageUrl = "";
    if (req.file) {
      imageUrl = await uploadToFirebase(req.file, "PromoCodeImages");
    }

    // Create a new promo code object
    await PromoCode.create({
      promoCode: promoCode.toUpperCase(),
      promoType,
      discount,
      description,
      fromDate,
      toDate,
      maxDiscountValue,
      minOrderAmount,
      maxAllowedUsers,
      appliedOn,
      applicationMode,
      merchantId,
      geofenceId,
      imageUrl,
      deliveryMode,
    });

    // Send a success response
    res.status(201).json({
      message: "Promo code added successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

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
    const { promoCodeId } = req.params;

    let existingPromoCode = await PromoCode.findById(promoCodeId);
    if (!existingPromoCode) return next(appError("Promo code not found", 404));

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
      applicationMode,
      merchantId,
      geofenceId,
      deliveryMode,
    } = req.body;

    let imageUrl = existingPromoCode?.imageUrl;
    if (req.file) {
      if (imageUrl) await deleteFromFirebase(imageUrl);
      imageUrl = await uploadToFirebase(req.file, "PromoCodeImages");
    }

    await PromoCode.findByIdAndUpdate(
      promoCodeId,
      {
        promoCode: promoCode.toUpperCase(),
        promoType,
        discount,
        description,
        fromDate,
        toDate,
        maxDiscountValue,
        minOrderAmount,
        maxAllowedUsers,
        appliedOn,
        applicationMode,
        merchantId,
        geofenceId,
        deliveryMode,
        imageUrl,
      },
      { new: true }
    );

    res.status(200).json({
      message: "Promo code updated successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAllPromoCodesController = async (req, res, next) => {
  try {
    const promoCodes = await PromoCode.find({});

    const formattedResponse = promoCodes?.map((promoCode) => ({
      promoCodeId: promoCode._id,
      promoCode: promoCode.promoCode || null,
      promoValue:
        promoCode.promoType === "Flat-discount"
          ? `₹ ${promoCode.discount}`
          : `${promoCode.discount} %`,
      maxDiscountValue: promoCode.maxDiscountValue || null,
      minOrderAmount: promoCode.minOrderAmount || null,
      fromDate: formatDate(promoCode.fromDate),
      toDate: formatDate(promoCode.toDate),
      description: promoCode.description || null,
      applicationMode: promoCode.applicationMode || null,
      appliedOn: promoCode.appliedOn || null,
      noOfUserUsed: promoCode.noOfUserUsed || 0,
      maxAllowedUsers: promoCode.maxAllowedUsers,
      status: promoCode.status || null,
    }));

    res.status(200).json(formattedResponse);
  } catch (err) {
    next(appError(err.message));
  }
};

const getSinglePromoCodeController = async (req, res, next) => {
  try {
    const { promoCodeId } = req.params;

    const promoCode = await PromoCode.findById(promoCodeId);

    if (!promoCode) return next(appError("Promo code not found", 404));

    const formattedResponse = {
      promoCode: promoCode.promoCode || null,
      promoType: promoCode.promoType || null,
      discount: promoCode.discount || null,
      description: promoCode.description || null,
      fromDate: promoCode.fromDate || null,
      toDate: promoCode.toDate || null,
      maxDiscountValue: promoCode.maxDiscountValue || null,
      minOrderAmount: promoCode.minOrderAmount || null,
      maxAllowedUsers: promoCode.maxAllowedUsers || null,
      appliedOn: promoCode.appliedOn || null,
      applicationMode: promoCode.applicationMode || null,
      merchantId: promoCode.merchantId || [],
      geofenceId: promoCode.geofenceId || null,
      imageUrl: promoCode.imageUrl || null,
      status: promoCode.status || null,
      noOfUserUsed: promoCode.noOfUserUsed || null,
      deliveryMode: promoCode.deliveryMode || null,
    };

    res.status(200).json(formattedResponse);
  } catch (err) {
    next(appError(err.message));
  }
};

const deletePromoCodeController = async (req, res, next) => {
  try {
    const { promoCodeId } = req.params;

    const deletedPromoCode = await PromoCode.findByIdAndDelete(promoCodeId);

    if (!deletedPromoCode) next(appError("Promo code not found", 404));

    res.status(200).json({
      message: "Promo code deleted successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const editPromoCodeStatusController = async (req, res, next) => {
  try {
    const { promoCodeId } = req.params;
    const promoCode = await PromoCode.findById(promoCodeId);

    if (!promoCode) return next(appError("Promo code not found", 404));

    promoCode.status = !promoCode.status;

    await promoCode.save();

    return res.status(200).json({
      message: "PromoCode status updated successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  addPromoCodeController,
  editPromoCodeController,
  deletePromoCodeController,
  getAllPromoCodesController,
  getSinglePromoCodeController,
  editPromoCodeStatusController,
};
