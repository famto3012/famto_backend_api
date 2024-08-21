const express = require("express");
const {
  getAllCategoriesOfMerchantByAdminController,
  getSingleCategoryOfMerchantByAdminController,
  addCategoryByAdminController,
  editCategoryByAdminController,
  deleteCategoryByAdminController,
  addCategoryByMerchantController,
  getAllCategoriesByMerchantController,
  getSingleCategoryByMerchantController,
  editCategoryByMerchantController,
  deleteCategoryByMerchantController,
  changeCategoryStatusByAdminController,
  changeCategoryStatusByMerchantController,
  updateCategoryOrderController,
  addCategoryFromCSVController,
} = require("../../../../controllers/admin/merchant/category/categoryController");
const { upload } = require("../../../../utils/imageOperation");
const isAuthenticated = require("../../../../middlewares/isAuthenticated");
const {
  addCategoryByAdminValidation,
  editCategoryByAdminValidation,
  addCategoryByMerchantValidation,
  editCategoryByMerchantValidation,
} = require("../../../../middlewares/validators/categoryValidations");
const isAdmin = require("../../../../middlewares/isAdmin");
const isAdminOrMerchant = require("../../../../middlewares/isAdminOrMerchant");

const categoryRoute = express.Router();

// ----------------------------------------------------
// For Admin
// ----------------------------------------------------

//Get all category of a merchant by Admin
categoryRoute.get(
  "/admin/:merchantId",
  isAuthenticated,
  isAdmin,
  getAllCategoriesOfMerchantByAdminController
);

//Get single category of a merchant by Admin
categoryRoute.get(
  "/admin/:merchantId/:categoryId",
  isAuthenticated,
  isAdmin,
  getSingleCategoryOfMerchantByAdminController
);

//Add category by Admin
categoryRoute.post(
  "/admin/add-category",
  upload.single("categoryImage"),
  addCategoryByAdminValidation,
  isAuthenticated,
  isAdmin,
  addCategoryByAdminController
);

//Edit category by Admin
categoryRoute.put(
  "/admin/edit-category/:merchantId/:categoryId",
  upload.single("categoryImage"),
  editCategoryByAdminValidation,
  isAuthenticated,
  isAdmin,
  editCategoryByAdminController
);

//Delete category by Admin
categoryRoute.delete(
  "/admin/delete-category/:merchantId/:categoryId",
  isAuthenticated,
  isAdmin,
  deleteCategoryByAdminController
);

//Change category status by Admin
categoryRoute.patch(
  "/admin/change-status/:merchantId/:categoryId",
  isAuthenticated,
  isAdmin,
  changeCategoryStatusByAdminController
);

//Change category order by Admin
categoryRoute.put(
  "/admin/change-order",
  isAuthenticated,
  isAdminOrMerchant,
  updateCategoryOrderController
);

// Upload categories from CSV by Admin
categoryRoute.post(
  "/admin/upload-category-csv",
  upload.single("categoryCSV"),
  isAuthenticated,
  isAdminOrMerchant,
  addCategoryFromCSVController
);

// ----------------------------------------------------
// For Merchant
// ----------------------------------------------------

//Add category by Merchant
categoryRoute.post(
  "/add-category",
  upload.single("categoryImage"),
  addCategoryByMerchantValidation,
  isAuthenticated,
  addCategoryByMerchantController
);

//Get all category by Merchant
categoryRoute.get(
  "/all-categories",
  isAuthenticated,
  getAllCategoriesByMerchantController
);

//Get single category by Merchant
categoryRoute.get(
  "/:categoryId",
  isAuthenticated,
  getSingleCategoryByMerchantController
);

//Edit category by Merchant
categoryRoute.put(
  "/:categoryId",
  upload.single("categoryImage"),
  editCategoryByMerchantValidation,
  isAuthenticated,
  editCategoryByMerchantController
);

//Delete category by Merchant
categoryRoute.delete(
  "/:categoryId",
  isAuthenticated,
  deleteCategoryByMerchantController
);

//Change category status by Merchant
categoryRoute.patch(
  "/change-status/:categoryId",
  isAuthenticated,
  changeCategoryStatusByMerchantController
);

module.exports = categoryRoute;
