const express = require("express");
const {
  addCategoryController,
  editCategoryController,
  deleteCategoryController,
} = require("../../controllers/category/categoryController");
const { upload } = require("../../utils/imageOperation");
const isAuthenticated = require("../../middlewares/isAuthenticated");

const categoryRoute = express.Router();

//TODO: Need to add Role based Authentication
categoryRoute.post(
  "/add-category",
  upload.single("categoryImage"),
  isAuthenticated,
  addCategoryController
);

//TODO: Need to add Role based Authentication
categoryRoute.put(
  "/edit-category/:categoryId",
  upload.single("categoryImage"),
  isAuthenticated,
  editCategoryController
);

//TODO: Need to add Role based Authentication
categoryRoute.delete(
  "/delete-category/:categoryId",
  isAuthenticated,
  deleteCategoryController
);

module.exports = categoryRoute;
