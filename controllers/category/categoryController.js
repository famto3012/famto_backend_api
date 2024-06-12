const { validationResult } = require("express-validator");
const Category = require("../../models/Category");
const appError = require("../../utils/appError");
const { uploadToFirebase } = require("../../utils/imageOperation");

const addCategoryController = async (req, res, next) => {
  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }
  try {
    const { bussinessCategory, categoryName, description, type } = req.body;

    const existingCategory = await Category.findOne({
      bussinessCategory,
      categoryName,
    });

    if (existingCategory) {
      formattedErrors.categoryName =
        "Category name already exists for the same bussiness category";
      return res.status(409).json({ errors: formattedErrors });
    }

    let categoryImageURL = "";

    if (req.file) {
      const { categoryImage } = req.file;

      categoryImageURL = await uploadToFirebase(
        categoryImage,
        "CategoryImages"
      );
    }

    const newCategory = await Category.create({
      bussinessCategory,
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

module.exports = { addCategoryController };
