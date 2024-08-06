const express = require("express");
const {
  addProductController,
  editProductController,
  deleteProductController,
  getProductController,
  searchProductController,
  addVariantToProductController,
  deleteVariantTypeController,
  editVariantController,
  getProductByCategoryController,
  changeProductCategoryController,
  changeInventoryStatusController,
  getAllProductsByMerchant,
  updateProductOrderController,
} = require("../../../../controllers/admin/merchant/product/productController");
const { upload } = require("../../../../utils/imageOperation");
const {
  addProductValidations,
  editProductValidations,
  productVariantValidations,
} = require("../../../../middlewares/validators/productValidations");
const isAuthenticated = require("../../../../middlewares/isAuthenticated");
const isAdminOrMerchant = require("../../../../middlewares/isAdminOrMerchant");

const productRoute = express.Router();

//Search Product Details
productRoute.get("/search", isAuthenticated, searchProductController);

//Get Product by category
productRoute.get(
  "/product-by-category/:categoryId",
  isAuthenticated,
  getProductByCategoryController
);

//Add Product
productRoute.post(
  "/add-product",
  upload.single("productImage"),
  addProductValidations,
  isAuthenticated,
  isAdminOrMerchant,
  addProductController
);

productRoute.get(
  "/all-products-of-merchant/:merchantId",
  isAuthenticated,
  isAdminOrMerchant,
  getAllProductsByMerchant
);

//Get Product
productRoute.get(
  "/:productId",
  isAuthenticated,
  isAdminOrMerchant,
  getProductController
);

//Edit Product
productRoute.put(
  "/edit-product/:productId",
  upload.single("productImage"),
  editProductValidations,
  isAuthenticated,
  isAdminOrMerchant,
  editProductController
);

//Delete Product
productRoute.delete(
  "/delete-product/:productId",
  isAuthenticated,
  isAdminOrMerchant,
  deleteProductController
);

// Change product category
productRoute.patch(
  "/:productId/change-category/:categoryId",
  isAuthenticated,
  isAdminOrMerchant,
  changeProductCategoryController
);

// Change inventory status
productRoute.patch(
  "/change-inventory-status/:productId",
  isAuthenticated,
  isAdminOrMerchant,
  changeInventoryStatusController
);

// Change product order
productRoute.put(
  "/change-order",
  isAuthenticated,
  isAdminOrMerchant,
  updateProductOrderController
);

//Variants
// -------------------------------

//Add variants to product
productRoute.post(
  "/:productId/add-variants",
  productVariantValidations,
  isAuthenticated,
  isAdminOrMerchant,
  addVariantToProductController
);

//Edit product variants
productRoute.put(
  "/:productId/variants/:variantId",
  productVariantValidations,
  isAuthenticated,
  isAdminOrMerchant,
  editVariantController
);

//Delete product variant type
productRoute.delete(
  "/:productId/variants/:variantId/types/:variantTypeId",
  isAdminOrMerchant,
  deleteVariantTypeController
);

module.exports = productRoute;
