const { validationResult } = require("express-validator");
const Category = require("../../../../models/Category");
const appError = require("../../../../utils/appError");
const {
  uploadToFirebase,
  deleteFromFirebase,
} = require("../../../../utils/imageOperation");
const path = require("path");
const Product = require("../../../../models/Product");
const Merchant = require("../../../../models/Merchant");
const csvWriter = require("csv-writer").createObjectCsvWriter;

const getSelectedBusinessCategoriesOfMerchant = async (req, res, next) => {
  try {
    const { merchantId } = req.params;

    if (!merchantId) return next(appError("Merchant id is required", 400));

    const merchantFound = await Merchant.findById(merchantId)
      .select("merchantDetail.businessCategoryId")
      .populate("merchantDetail.businessCategoryId", "title");

    if (!merchantFound) return next(appError("Merchant not found", 404));

    res.status(200).json({
      message: "Selected business categories",
      data: merchantFound?.merchantDetail?.businessCategoryId || [],
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// ----------------------------------------------------
// For Admin
// ----------------------------------------------------

const getAllCategoriesOfMerchantByAdminController = async (req, res, next) => {
  try {
    const merchantId = req.params.merchantId;

    const categoriesOfMerchant = await Category.find({ merchantId })
      .select("categoryName merchantId status")
      .sort({ order: 1 });

    res.status(200).json({
      message: "Categories of merchant",
      data: categoriesOfMerchant,
    });
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

    const lastCategory = await Category.findOne().sort({
      order: -1,
    });

    const newOrder = lastCategory ? lastCategory.order + 1 : 1;

    let newCategory = await Category.create({
      businessCategoryId,
      merchantId,
      categoryName,
      description,
      type,
      categoryImageURL,
      order: newOrder,
    });

    if (!newCategory) {
      return next(appError("Error in creating new category"));
    }

    res.status(201).json({
      message: "Category created successfully",
      data: newCategory,
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

    let categoryImageURL = categoryToUpdate?.categoryImageURL;

    if (req.file) {
      if (categoryImageURL) {
        await deleteFromFirebase(categoryImageURL);
      }

      categoryImageURL = await uploadToFirebase(req.file, "CategoryImages");
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      req.params.categoryId,
      {
        businessCategoryId: businessCategoryId._id,
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
      data: updatedCategory,
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

    const allProducts = await Product.find({
      categoryId: req.params.categoryId,
    });

    allProducts.forEach(async (product) => {
      let productImageURL = product?.productImageURL;

      if (productImageURL) {
        await deleteFromFirebase(productImageURL);
      }

      await Product.findByIdAndDelete(product._id);
    });

    res.status(200).json({
      message: "Category deleted successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const changeCategoryStatusByAdminController = async (req, res, next) => {
  try {
    const { categoryId, merchantId } = req.params;

    const categoryFound = await Category.findOne({
      _id: categoryId,
      merchantId,
    });

    if (!categoryFound) return next(appError("Category not found", 404));

    categoryFound.status = !categoryFound.status;

    await Product.updateMany(
      { categoryId },
      { inventory: categoryFound.status }
    );

    await categoryFound.save();

    res.status(200).json({
      message: "Category status changed and products updated",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const downloadCategorySampleCSVController = async (req, res, next) => {
  try {
    // Define the path to your sample CSV file
    const filePath = path.join(
      __dirname,
      "../../../../sample_CSV/sample_CSV.csv"
    );

    // Define the headers and data for the CSV
    const csvHeaders = [
      { id: "businessCategoryName", title: "Business Category name" },
      { id: "categoryName", title: "Category name" },
      { id: "description", title: "Description" },
      { id: "type", title: "Type" },
      { id: "status", title: "Status" },
    ];

    const csvData = [
      {
        businessCategoryName: "Food / Grocery / Vegetables / Fruits",
        categoryName: "Category 1",
        description: "Description 1",
        type: "Veg / Non-veg / Both",
        status: "TRUE / FALSE",
      },
      {
        businessCategoryName: "Food / Grocery / Vegetables / Fruits",
        categoryName: "Category 2",
        description: "Description 2",
        type: "Veg / Non-veg / Both",
        status: "TRUE / FALSE",
      },
    ];

    // Create a new CSV writer
    const writer = csvWriter({
      path: filePath,
      header: csvHeaders,
    });

    // Write the data to the CSV file
    await writer.writeRecords(csvData);

    // Send the CSV file as a response for download
    res.download(filePath, "Category_sample.csv", (err) => {
      if (err) {
        next(err);
      }
    });
  } catch (error) {
    res.status(500).send("Error processing the CSV file");
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

    // Find the highest order number
    const lastCategory = await Category.findOne().sort({
      order: -1,
    });

    const newOrder = lastCategory ? lastCategory.order + 1 : 1;

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
      order: newOrder,
    });

    if (!newCategory) {
      return next(appError("Error in creating new category"));
    }

    res.status(201).json({
      message: "Category created successfully",
      data: newCategory,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAllCategoriesByMerchantController = async (req, res, next) => {
  try {
    const merchantId = req.userAuth;

    const categoriesOfMerchant = await Category.find({ merchantId })
      .select("categoryName merchantId status")
      .sort({ order: 1 });

    res.status(200).json({
      message: "Categories of merchant",
      data: categoriesOfMerchant,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getSingleCategoryByMerchantController = async (req, res, next) => {
  try {
    const categoryFound = await Category.findOne({
      _id: req.params.categoryId,
      merchantId: req.userAuth,
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

const editCategoryByMerchantController = async (req, res, next) => {
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

    const categoryToUpdate = await Category.findOne({
      _id: req.params.categoryId,
      merchantId,
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

    const updatedCategory = await Category.findByIdAndUpdate(
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
      data: updatedCategory,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const deleteCategoryByMerchantController = async (req, res, next) => {
  try {
    const merchantId = req.userAuth;

    const categoryToDelete = await Category.findOne({
      _id: req.params.categoryId,
      merchantId,
    });

    if (!categoryToDelete) {
      return next(appError("Category not found", 404));
    }

    let categoryImageURL = categoryToDelete.categoryImageURL;

    if (categoryImageURL) {
      await deleteFromFirebase(categoryImageURL);
    }

    await Category.findByIdAndDelete(req.params.categoryId);

    const allProducts = await Product.find({
      categoryId: req.params.categoryId,
    });

    allProducts.forEach(async (product) => {
      let productImageURL = product?.productImageURL;

      if (productImageURL) {
        await deleteFromFirebase(productImageURL);
      }

      await Product.findByIdAndDelete(product._id);
    });

    res.status(200).json({
      message: "Category deleted successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const changeCategoryStatusByMerchantController = async (req, res, next) => {
  try {
    const merchantId = req.userAuth;
    const { categoryId } = req.params;

    const categoryFound = await Category.findOne({
      _id: req.params.categoryId,
      merchantId,
    });

    if (!categoryFound) return next(appError("Category not found", 404));

    categoryFound.status = !categoryFound.status;

    await Product.updateMany(
      { categoryId },
      { inventory: categoryFound.status }
    );

    await categoryFound.save();

    res.status(200).json({
      message: "Category status changed and products updated",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const updateCategoryOrderController = async (req, res, next) => {
  const { categories } = req.body;

  try {
    for (const category of categories) {
      await Category.findByIdAndUpdate(
        category.id,
        { order: category.order },
        { new: true }
      );
    }

    res.status(200).json({ message: "Category order updated successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  getSelectedBusinessCategoriesOfMerchant,
  getAllCategoriesOfMerchantByAdminController,
  getSingleCategoryOfMerchantByAdminController,
  addCategoryByAdminController,
  editCategoryByAdminController,
  deleteCategoryByAdminController,
  changeCategoryStatusByAdminController,
  addCategoryByMerchantController,
  getAllCategoriesByMerchantController,
  getSingleCategoryByMerchantController,
  editCategoryByMerchantController,
  deleteCategoryByMerchantController,
  changeCategoryStatusByMerchantController,
  updateCategoryOrderController,
  downloadCategorySampleCSVController,
};
