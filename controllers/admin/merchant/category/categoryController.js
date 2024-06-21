const { validationResult } = require("express-validator");
const Category = require("../../../../models/Category");
const appError = require("../../../../utils/appError");
const {
  uploadToFirebase,
  deleteFromFirebase,
} = require("../../../../utils/imageOperation");

// ----------------------------------------------------
// For Admin
// ----------------------------------------------------

const getAllCategoriesOfMerchantByAdminController = async (req, res, next) => {
  try {
    const merchantId = req.params.merchantId;

    const categoriesOfMerchant = await Category.find({ merchantId }).select(
      "categoryName merchantId"
    );

    res
      .status(200)
      .json({ message: "Categories of merchant", data: categoriesOfMerchant });
  } catch (err) {
    next(appError(err.message));
  }
};

const getSingleCategoryOfMerchantByAdminController = async (req, res, next) => {
  try {
    const categoryFound = await Category.findOne({
      _id: req.params.categoryId,
      merchantId: req.params.merchantId,
    })
      .populate("businessCategoryId", "title")
      .select("-merchantId");

    if (!categoryFound) {
      return next(appError("Category not found", 404));
    }

    res.status(200).json({
      message: "Single category detail",
      data: categoryFound,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const addCategoryByAdminController = async (req, res, next) => {
  const { businessCategoryId, merchantId, categoryName, description, type } =
    req.body;

  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const existingCategory = await Category.findOne({
      merchantId,
      categoryName,
    });

    if (existingCategory) {
      formattedErrors.categoryName =
        "Category name already exists for the same business category";
      return res.status(409).json({ errors: formattedErrors });
    }

    let categoryImageURL = "";

    if (req.file) {
      categoryImageURL = await uploadToFirebase(req.file, "CategoryImages");
    }

    const newCategory = await Category.create({
      businessCategoryId,
      merchantId,
      categoryName,
      description,
      type,
      categoryImageURL,
    });

    if (!newCategory) {
      return next(appError("Error in creating new category"));
    }

    res.status(200).json({
      message: "Category created successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const editCategoryByAdminController = async (req, res, next) => {
  const { businessCategoryId, merchantId, categoryName, description, type } =
    req.body;

  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const categoryToUpdate = await Category.findOne({
      _id: req.params.categoryId,
      merchantId: req.params.merchantId,
    });

    if (!categoryToUpdate) {
      return next(appError("Category not found", 404));
    }

    let categoryImageURL = categoryToUpdate.categoryImageURL;

    if (req.file) {
      // Delete the old file from Firebase
      if (categoryImageURL) {
        await deleteFromFirebase(categoryImageURL);
      }

      // Upload the new file to Firebase
      categoryImageURL = await uploadToFirebase(req.file, "CategoryImages");
    }

    await Category.findByIdAndUpdate(
      req.params.categoryId,
      {
        businessCategoryId,
        merchantId,
        categoryName,
        description,
        type,
        categoryImageURL,
      },
      { new: true }
    );

    res.status(200).json({
      message: "Category updated successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const deleteCategoryByAdminController = async (req, res, next) => {
  try {
    const categoryToDelete = await Category.findOne({
      _id: req.params.categoryId,
      merchantId: req.params.merchantId,
    });

    if (!categoryToDelete) {
      return next(appError("Category not found", 404));
    }

    let categoryImageURL = categoryToDelete.categoryImageURL;

    if (categoryImageURL) {
      await deleteFromFirebase(categoryImageURL);
    }

    await Category.findByIdAndDelete(req.params.categoryId);

    res.status(200).json({
      message: "Category deleted successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// ----------------------------------------------------
// For Merchant
// ----------------------------------------------------

const addCategoryByMerchantController = async (req, res, next) => {
  const { businessCategoryId, categoryName, description, type } = req.body;

  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const merchantId = req.userAuth;

    const existingCategory = await Category.findOne({
      merchantId,
      categoryName,
    });

    if (existingCategory) {
      formattedErrors.categoryName =
        "Category name already exists for the same business category";
      return res.status(409).json({ errors: formattedErrors });
    }

    let categoryImageURL = "";

    if (req.file) {
      categoryImageURL = await uploadToFirebase(req.file, "CategoryImages");
    }

    const newCategory = await Category.create({
      businessCategoryId,
      merchantId,
      categoryName,
      description,
      type,
      categoryImageURL,
    });

    if (!newCategory) {
      return next(appError("Error in creating new category"));
    }

    res.status(200).json({
      message: "Category created successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  getAllCategoriesOfMerchantByAdminController,
  getSingleCategoryOfMerchantByAdminController,
  addCategoryByAdminController,
  editCategoryByAdminController,
  deleteCategoryByAdminController,
  addCategoryByMerchantController,
};
