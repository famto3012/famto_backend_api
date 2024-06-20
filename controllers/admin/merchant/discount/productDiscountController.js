
const { validationResult } = require("express-validator");
const ProductDiscount = require("../../../../models/ProductDiscount");
const appError = require("../../../../utils/appError");


// For Merchant
const addProductDiscountController = async (req, res, next) => {
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
      maxAmount,
      discountType,
      discountValue,
      description,
      productId,
      validFrom,
      validTo,
      geofenceId,
      onAddOn,
    } = req.body;

    const addProductDiscount = new ProductDiscount({
      discountName,
      maxAmount,
      discountType,
      discountValue,
      description,
      validFrom,
      validTo,
      geofenceId,
      merchantId,
      productId,
      onAddOn,
    });

    addProductDiscount.save();

    res.status(201).json({
      success: "Product Discount created successfully",
      data: addProductDiscount,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const editProductDiscountController = async (req, res, next) => {
  try {
    const { id } = req.params;

    let existingDiscount = await ProductDiscount.findById(id);
    if (!existingDiscount) {
      return res.status(404).json({ error: "Discount not found" });
    }

    const updateFields = [
      "discountName",
      "maxAmount",
      "discountType",
      "discountValue",
      "description",
      "validFrom",
      "validTo",
      "geofenceId",
      "onAddOn",
      "productId",
    ];

    updateFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        existingDiscount[field] = req.body[field];
      }
    });

    const updatedDiscount = await existingDiscount.save();

    res.status(200).json({
      success: "Product Discount updated successfully",
      data: updatedDiscount,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const deleteProductDiscountController = async (req, res, next) => {
  try {
    const { id } = req.params;

    const discount = await ProductDiscount.findById(id);
    if (!discount) {
      return res.status(404).json({ error: "Discount not found" });
    }

    await ProductDiscount.findByIdAndDelete(id);

    res.status(200).json({
      success: "Product Discount deleted successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAllProductDiscountController = async (req, res, next) => {
  try {
    const merchantId = req.userAuth;

    const discounts = await ProductDiscount.find({ merchantId });

    if (!discounts || discounts.length === 0) {
      return res
        .status(404)
        .json({ error: "No discounts found for this merchant" });
    }

    res.status(200).json({
      success: "Product Discounts retrieved successfully",
      data: discounts,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const updateProductDiscountStatusController = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Find the banner by ID and delete it
    const updateDiscount = await ProductDiscount.findOne({ _id: id });

    // Check if the banner was found and deleted
    if (!updateDiscount) {
      return next(appError("Discount not found", 404));
    } else if (updateDiscount.status) {
      updateDiscount.status = false;
    } else {
      updateDiscount.status = true;
    }

    await updateDiscount.save();

    res.status(200).json({
      success: true,
      message: "Product Discount status updated successfully!",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

//For Admin
const addProductDiscountAdminController = async (req, res, next) => {
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
        maxAmount,
        discountType,
        discountValue,
        description,
        validFrom,
        validTo,
        geofenceId,
        merchantId,
        productId,
        onAddOn,
      } = req.body;
  
      const addDiscount = new ProductDiscount({
        discountName,
        maxAmount,
        discountType,
        discountValue,
        description,
        validFrom,
        validTo,
        geofenceId,
        merchantId,
        productId,
        onAddOn
      });
  
      addDiscount.save();
  
      res.status(201).json({
        success: "Product Discount created successfully",
        data: addDiscount,
      });
    } catch (err) {
      next(appError(err.message));
    }
  };
  
module.exports = {
  addProductDiscountController,
  editProductDiscountController,
  deleteProductDiscountController,
  getAllProductDiscountController,
  updateProductDiscountStatusController,
  addProductDiscountAdminController,
};
