const express = require("express");
const {
  addCategoryController,
} = require("../../controllers/category/categoryController");
const { upload } = require("../../utils/imageOperation");

const categoryRoute = express.Router();

categoryRoute.post(
  "/add-category",
  upload.single("categoryImage"),
  addCategoryController
);

module.exports = categoryRoute;
