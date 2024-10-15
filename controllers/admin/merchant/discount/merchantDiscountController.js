const { validationResult } = require("express-validator");
const MerchantDiscount = require("../../../../models/MerchantDiscount");
const appError = require("../../../../utils/appError");
const ProductDiscount = require("../../../../models/ProductDiscount");

// =========================
// ========Merchant=========
// =========================
const  addDiscountController = async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    let formattedErrors = {};
    errors.array().forEach((error) => {
      formattedErrors[error.param] = error.msg;
    });
    return res.status(400).json({ errors: formattedErrors });
  }

  try {
    const merchantId = req.userAuth;
    const {
      discountName,
      maxCheckoutValue,
      maxDiscountValue,
      discountType,
      discountValue,
      description,
      validFrom,
      validTo,
      geofenceId,
    } = req.body;

    let addDiscount = await MerchantDiscount.create({
      discountName,
      maxCheckoutValue,
      maxDiscountValue,
      discountType,
      discountValue,
      description,
      validFrom,
      validTo,
      geofenceId,
      merchantId,
    });

    addDiscount = await addDiscount.populate("geofenceId", "name");

    res.status(201).json({
      success: "Discount created successfully",
      data: addDiscount,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const editDiscountController = async (req, res, next) => {
  try {
    const { id } = req.params;

    let existingDiscount = await MerchantDiscount.findById(id);
    if (!existingDiscount) {
      return res.status(404).json({ error: "Discount not found" });
    }

    const updateFields = [
      "discountName",
      "maxCheckoutValue",
      "maxDiscountValue",
      "discountType",
      "discountValue",
      "description",
      "validFrom",
      "validTo",
      "geofenceId",
    ];

    updateFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        existingDiscount[field] = req.body[field];
      }
    });

    let updatedDiscount = await existingDiscount.save();

    updatedDiscount = await updatedDiscount.populate("geofenceId", "name");

    res.status(200).json({
      success: "Discount updated successfully",
      data: updatedDiscount,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const deleteDiscountController = async (req, res, next) => {
  try {
    const { id } = req.params;

    const discount = await MerchantDiscount.findById(id);
    if (!discount) {
      return res.status(404).json({ error: "Discount not found" });
    }

    await MerchantDiscount.findByIdAndDelete(id);

    res.status(200).json({
      success: "Discount deleted successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAllDiscountController = async (req, res, next) => {
  try {
    const merchantId = req.userAuth;

    const discounts = await MerchantDiscount.find({ merchantId }).populate(
      "geofenceId",
      "name"
    );

    res.status(200).json({
      success: "Discounts retrieved successfully",
      data: discounts || [],
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const updateDiscountStatusController = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Find the discount by ID
    const updateDiscount = await MerchantDiscount.findOne({ _id: id });

    // Check if the discount was found
    if (!updateDiscount) {
      return next(appError("Discount not found", 404));
    }

    // Check if the current discount is being turned on
    if (!updateDiscount.status) {
      // Turn off all other discounts of the same merchant
      await MerchantDiscount.updateMany(
        { merchantId: updateDiscount.merchantId, _id: { $ne: id } }, // Exclude the current discount by ID
        { $set: { status: false } } // Turn off all other discounts
      );
    }

    // Toggle the status of the current discount
    updateDiscount.status = !updateDiscount.status;

    // Save the updated discount status
    await updateDiscount.save();

    res.status(200).json({
      success: true,
      message: "Discount status updated successfully!",
    });
  } catch (err) {
    next(appError(err.message));
  }
};



const updateAllDiscountController = async (req, res, next) => {
  try {
    const { id } = req.userAuth;
    const merchantDiscounts = await MerchantDiscount.find({ merchantId: id });
    const productDiscounts = await ProductDiscount.find({ merchantId: id });

    const discounts = [...merchantDiscounts, ...productDiscounts];

    if (!discounts || discounts.length === 0) {
      return res
        .status(404)
        .json({ error: "No discounts found for this merchant" });
    }

    // Iterate through each promo code and update the status if it's true
    const updatedDiscount = await Promise.all(
      discounts.map(async (discount) => {
        if (discount.status === true) {
          discount.status = false;
          await discount.save();
        }
        return discount;
      })
    );

    // Send a success response with the updated promo codes
    return res.status(200).json({
      success: "Discount status updated successfully",
      data: updatedDiscount,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getMerchantDiscountByIdController = async (req, res, next) => {
  try {
    const { id } = req.params; // Extract the ID from the request parameters

    // Find the MerchantDiscount by ID
    const merchantDiscount = await MerchantDiscount.findById(id);

    // Check if the MerchantDiscount exists
    if (!merchantDiscount) {
      return res.status(404).json({
        error: "MerchantDiscount not found",
      });
    }

    // Return the MerchantDiscount data
    res.status(200).json({
      success: "MerchantDiscount retrieved successfully",
      data: merchantDiscount,
    });
  } catch (err) {
    // Handle any errors
    next(appError(err.message));
  }
};

// =========================
// ==========Admin==========
// =========================
const addDiscountAdminController = async (req, res, next) => {
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
      discountName,
      maxCheckoutValue,
      maxDiscountValue,
      discountType,
      discountValue,
      description,
      validFrom,
      validTo,
      geofenceId,
      merchantId,
    } = req.body;

    let addDiscount = await MerchantDiscount.create({
      discountName,
      maxCheckoutValue,
      maxDiscountValue,
      discountType,
      discountValue,
      description,
      validFrom,
      validTo,
      geofenceId,
      merchantId,
    });

    addDiscount = await addDiscount.populate("geofenceId", "name");

    res.status(201).json({
      success: "Discount created successfully",
      data: addDiscount,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const updateAllDiscountAdminController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const merchantDiscounts = await MerchantDiscount.find({ merchantId: id });
    const productDiscounts = await ProductDiscount.find({ merchantId: id });

    const discounts = [...merchantDiscounts, ...productDiscounts];

    if (!discounts || discounts.length === 0) {
      return res
        .status(404)
        .json({ error: "No discounts found for this merchant" });
    }

    // Iterate through each promo code and update the status if it's true
    const updatedDiscount = await Promise.all(
      discounts.map(async (discount) => {
        if (discount.status === true) {
          discount.status = false;
          await discount.save();
        }
        return discount;
      })
    );

    // Send a success response with the updated promo codes
    return res.status(200).json({
      success: "Discount status updated successfully",
      data: updatedDiscount,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAllDiscountAdminController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const merchantDiscounts = await MerchantDiscount.find({
      merchantId: id,
    }).populate("geofenceId", "name");
    const productDiscounts = await ProductDiscount.find({
      merchantId: id,
    }).populate("geofenceId", "name");

    const discounts = [...merchantDiscounts, ...productDiscounts];

    res.status(200).json({
      success: "Discounts retrieved successfully",
      data: discounts || [],
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  addDiscountController,
  editDiscountController,
  deleteDiscountController,
  getAllDiscountController,
  updateDiscountStatusController,
  addDiscountAdminController,
  getAllDiscountAdminController,
  updateAllDiscountAdminController,
  updateAllDiscountController,
  getMerchantDiscountByIdController,
};
