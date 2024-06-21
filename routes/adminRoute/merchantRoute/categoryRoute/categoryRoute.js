const express = require("express");
const {
  getAllCategoriesOfMerchantByAdminController,
  getSingleCategoryOfMerchantByAdminController,
  addCategoryByAdminController,
  editCategoryByAdminController,
  deleteCategoryByAdminController,
  addCategoryByMerchantController,
} = require("../../../../controllers/admin/merchant/category/categoryController");
const { upload } = require("../../../../utils/imageOperation");
const isAuthenticated = require("../../../../middlewares/isAuthenticated");
const {
  addCategoryValidation,
  editCategoryValidation,
} = require("../../../../middlewares/validators/categoryValidations");

const categoryRoute = express.Router();

// ----------------------------------------------------
// For Admin
// ----------------------------------------------------

//Get all category of a merchant by Admin
categoryRoute.get(
  "/admin/:merchantId",
  isAuthenticated,
  getAllCategoriesOfMerchantByAdminController
);

//Get single category of a merchant by Admin
categoryRoute.get(
  "/admin/:merchantId/:categoryId",
  isAuthenticated,
  getSingleCategoryOfMerchantByAdminController
);

//Add category by Admin
categoryRoute.post(
  "/admin/add-category",
  upload.single("categoryImage"),
  addCategoryValidation,
  isAuthenticated,
  addCategoryByAdminController
);

//Edit category by Admin
categoryRoute.put(
  "/admin/edit-category/:merchantId/:categoryId",
  upload.single("categoryImage"),
  editCategoryValidation,
  isAuthenticated,
  editCategoryByAdminController
);

//Delete category by Admin
categoryRoute.delete(
  "/admin/delete-category/:merchantId/:categoryId",
  isAuthenticated,
  deleteCategoryByAdminController
);

// ----------------------------------------------------
// For Merchant
// ----------------------------------------------------

//Add category by Admin
categoryRoute.post(
  "/add-category",
  upload.single("categoryImage"),
  addCategoryValidation,
  isAuthenticated,
  addCategoryByMerchantController
);

module.exports = categoryRoute;
