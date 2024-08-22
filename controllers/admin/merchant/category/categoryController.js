const csvParser = require("csv-parser");
const { Readable } = require("stream");
const fs = require("fs");
const { stringify } = require("csv-stringify");
const { parse } = require("csv-parse");
const path = require("path");
const { validationResult } = require("express-validator");
const Category = require("../../../../models/Category");
const appError = require("../../../../utils/appError");
const {
  uploadToFirebase,
  deleteFromFirebase,
} = require("../../../../utils/imageOperation");
const axios = require("axios");

// ----------------------------------------------------
// For Admin
// ----------------------------------------------------

const getAllCategoriesOfMerchantByAdminController = async (req, res, next) => {
  try {
    const merchantId = req.params.merchantId;

    const categoriesOfMerchant = await Category.find({ merchantId })
      .select("categoryName merchantId status")
      .sort({ order: 1 });

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

const changeCategoryStatusByAdminController = async (req, res, next) => {
  try {
    const categoryFound = await Category.findOne({
      _id: req.params.categoryId,
      merchantId: req.params.merchantId,
    });

    if (!categoryFound) {
      return next(appError("Category not found", 404));
    }

    categoryFound.status = !categoryFound.status;
    await categoryFound.save();

    res.status(200).json({ message: "Category status changed" });
  } catch (err) {
    next(appError(err.message));
  }
};

const downloadCategorySampleCSVController = async (req, res, next) => {
  try {
    const { businessCategoryId, merchantId } = req.body;

    if (!businessCategoryId || !merchantId) {
      return next(
        appError("Business Category Id and Merchant Id are required", 400)
      );
    }

    // Path to the sample CSV file
    const sampleCSVPath = path.join(
      __dirname,
      "../../../../sample_CSV/sample_CSV.csv"
    );

    // Read the sample CSV file
    const sampleCSVData = fs.readFileSync(sampleCSVPath, "utf8");

    // Parse the CSV data
    parse(sampleCSVData, { columns: true }, (err, records) => {
      if (err) {
        return next(appError("Error parsing CSV", 500));
      }

      // Add new columns and populate them with the passed values
      const updatedRecords = records.map((record) => ({
        "Business Category Id": businessCategoryId,
        "Merchant Id": merchantId,
        "Category name": record["Category name"],
        Description: record["Description"],
        Type: record["Type"],
        Status: record["Status"],
      }));

      // Convert the updated records back to CSV
      stringify(updatedRecords, { header: true }, (err, output) => {
        if (err) {
          return next(appError("Error generating CSV", 500));
        }

        // Convert the CSV output to a readable stream
        const stream = Readable.from(output);

        // Set the headers to trigger a download
        res.setHeader(
          "Content-disposition",
          "attachment; filename=Category_CSV.csv"
        );
        res.setHeader("Content-Type", "text/csv");

        // Pipe the stream to the response
        stream.pipe(res);
      });
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const addCategoryFromCSVController = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(appError("CSV file is required", 400));
    }

    // Upload the CSV file to Firebase and get the download URL
    const fileUrl = await uploadToFirebase(req.file, "csv-uploads");

    const categories = [];

    // Download the CSV data from Firebase Storage
    const response = await axios.get(fileUrl);
    const csvData = response.data;

    // Create a readable stream from the CSV data
    const stream = Readable.from(csvData);

    // Parse the CSV data
    stream
      .pipe(csvParser())
      .on("data", (row) => {
        const isRowEmpty = Object.values(row).every(
          (value) => value.trim() === ""
        );

        if (!isRowEmpty) {
          const category = {
            businessCategoryId: row["Business Category Id"]?.trim(),
            merchantId: row["Merchant Id"]?.trim(),
            categoryName: row["Category name"]?.trim(),
            description: row["Description"]?.trim(),
            type: row["Type"]?.trim(),
            status: row["Status"]?.toLowerCase(),
          };

          categories.push(category);
        }
      })
      .on("end", async () => {
        try {
          // Get the last category order
          let lastCategory = await Category.findOne().sort({ order: -1 });
          let newOrder = lastCategory ? lastCategory.order + 1 : 1;

          const categoryPromise = categories.map(async (categoryData) => {
            // Check if the category already exists
            const existingCategory = await Category.findOne({
              merchantId: categoryData.merchantId,
              categoryName: categoryData.categoryName,
            });

            if (existingCategory) {
              await Category.findByIdAndUpdate();
            } else {
              // Set the order and create the new category
              categoryData.order = newOrder++;
              const category = new Category(categoryData);
              return category.save();
            }
          });

          await Promise.all(categoryPromise);

          res.status(201).json({
            message: "Categories added successfully.",
            data: categories,
          });
        } catch (err) {
          next(appError(err.message));
        } finally {
          // Delete the file from Firebase after processing
          await deleteFromFirebase(fileUrl);
        }
      })
      .on("error", (error) => {
        next(appError(error.message));
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

    res.status(200).json({
      message: "Category created successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAllCategoriesByMerchantController = async (req, res, next) => {
  try {
    const merchantId = req.userAuth;

    const categoriesOfMerchant = await Category.find({ merchantId })
      .select("categoryName merchantId")
      .sort({ order: 1 });

    res
      .status(200)
      .json({ message: "Categories of merchant", data: categoriesOfMerchant });
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

    const categoryFound = await Category.findOne({
      _id: req.params.categoryId,
      merchantId,
    });

    if (!categoryFound) {
      return next(appError("Category not found", 404));
    }

    categoryFound.status = !categoryFound.status;
    await categoryFound.save();

    res.status(200).json({ message: "Category status changed" });
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
  addCategoryFromCSVController,
  downloadCategorySampleCSVController,
};
