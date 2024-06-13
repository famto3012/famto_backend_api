const express = require("express");
const {
  addCategoryController,
  editCategoryController,
  deleteCategoryController,
} = require("../../controllers/category/categoryController");
const { upload } = require("../../utils/imageOperation");
const isAuthenticated = require("../../middlewares/isAuthenticated");
const { body, check } = require("express-validator");

const categoryRoute = express.Router();

//TODO: Need to add Role based Authentication
categoryRoute.post(
  "/add-category",
  upload.single("categoryImage"),
  [
    body("bussinessCategoryId")
      .trim()
      .notEmpty()
      .withMessage("Bussinesss category is required"),
    body("merchantId").trim().notEmpty().withMessage("Merchant is required"),
    body("categoryName")
      .trim()
      .notEmpty()
      .withMessage("Category name is required"),
    body("description")
      .trim()
      .notEmpty()
      .withMessage("Description is required"),
    body("type").trim().notEmpty().withMessage("type is required"),
    check("categoryImage").custom((value, { req }) => {
      if (!req.file) {
        throw new Error("Category image is required");
      }
      return true;
    }),
  ],
  // isAuthenticated,
  addCategoryController
);

//TODO: Need to add Role based Authentication
categoryRoute.put(
  "/edit-category/:categoryId",
  upload.single("categoryImage"),
  // isAuthenticated,
  editCategoryController
);

//TODO: Need to add Role based Authentication
categoryRoute.delete(
  "/delete-category/:categoryId",
  // isAuthenticated,
  deleteCategoryController
);

module.exports = categoryRoute;
