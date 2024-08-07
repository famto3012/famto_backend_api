const { validationResult } = require("express-validator");
const Product = require("../../../../models/Product");
const appError = require("../../../../utils/appError");
const {
  uploadToFirebase,
  deleteFromFirebase,
} = require("../../../../utils/imageOperation");
const Category = require("../../../../models/Category");

// ------------------------------------------------------
// For Merchant and Admin
// -------------------------------------------------------

const addProductController = async (req, res, next) => {
  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.param] = error.msg;
    });
    console.log("Validation errors:", formattedErrors); // Debug logging
    return res.status(400).json({ errors: formattedErrors });
  }

  const {
    categoryId,
    productName,
    price,
    minQuantityToOrder,
    maxQuantityPerOrder,
    costPrice,
    sku,
    discountId,
    oftenBoughtTogetherId,
    preparationTime,
    // searchTags,
    description,
    longDescription,
    type,
    availableQuantity,
    alert,
  } = req.body;

  try {
    const existingProduct = await Product.findOne({ productName, categoryId });

    if (existingProduct) {
      formattedErrors.productName = "Product already exists";
      return res.status(409).json({ errors: formattedErrors });
    }

    // Find the highest order number
    const lastCategory = await Product.findOne().sort({ order: -1 });

    const newOrder = lastCategory ? lastCategory.order + 1 : 1;

    let productImageURL = "";

    if (req.file) {
      productImageURL = await uploadToFirebase(req.file, "ProductImages");
    }

    const newProduct = await Product.create({
      categoryId,
      productName,
      price,
      minQuantityToOrder,
      maxQuantityPerOrder,
      costPrice,
      sku,
      discountId: discountId || null,
      oftenBoughtTogetherId: oftenBoughtTogetherId || null,
      preparationTime,
      // searchTags,
      description,
      longDescription,
      type,
      availableQuantity,
      alert,
      productImageURL,
      order: newOrder,
    });

    if (!newProduct) {
      return next(appError("Error in creating new Product", 500));
    }

    res.status(201).json({
      message: "Product added successfully",
      data: newProduct,
    });
  } catch (err) {
    next(appError(err.message, 500));
  }
};

const getAllProductsByMerchant = async (req, res) => {
  try {
    const { merchantId } = req.params;

    const categories = await Category.find({ merchantId }).select("_id");

    const categoryIds = categories.map((category) => category._id);

    const products = await Product.find({
      categoryId: { $in: categoryIds },
    })
      .select("productName")
      .sort({ order: 1 });

    res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    next(appError(err.message));
  }
};

const getProductController = async (req, res, next) => {
  try {
    const productId = req.params.productId;

    const productFound = await Product.findById(productId)
      .populate("oftenBoughtTogetherId", "productName")
      .populate("discountId", "discountName")
      .populate("categoryId", "categoryName");

    if (!productFound) {
      return next(appError("Product not found", 404));
    }

    res.status(200).json({ message: "Product data", data: productFound });
  } catch (err) {
    next(appError(err.message));
  }
};

const editProductController = async (req, res, next) => {
  const {
    productName,
    productStatus,
    price,
    minQuantityToOrder,
    maxQuantityPerOrder,
    costPrice,
    sku,
    discountId,
    oftenBoughtTogetherId,
    preparationTime,
    // searchTags,
    description,
    longDescription,
    type,
    vaiantStatus,
  } = req.body;

  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const productToUpdate = await Product.findById(req.params.productId);

    if (!productToUpdate) {
      return next(appError("Product not found", 404));
    }

    let productImageURL = productToUpdate.productImageURL;

    if (req.file) {
      await deleteFromFirebase(productImageURL);
      productImageURL = await uploadToFirebase(req.file, "ProductImages");
    }

    await Product.findByIdAndUpdate(
      req.params.productId,
      {
        productName,
        productStatus,
        price,
        minQuantityToOrder,
        maxQuantityPerOrder,
        costPrice,
        sku,
        discountId: discountId || null,
        oftenBoughtTogetherId: oftenBoughtTogetherId || null,
        preparationTime,
        // searchTags,
        description,
        longDescription,
        type,
        productImageURL,
        vaiantStatus,
      },
      { new: true }
    );

    res.status(200).json({ message: "Product updated successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

const deleteProductController = async (req, res, next) => {
  try {
    const productToDelete = await Product.findById(req.params.productId);

    if (!productToDelete) {
      return next(appError("Product not found", 404));
    }

    let productImageURL = productToDelete.productImageURL;

    if (productImageURL) {
      await deleteFromFirebase(productImageURL);
    }

    await Product.findByIdAndDelete(req.params.productId);

    res.status(200).json({ message: "Product deleted successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

const searchProductController = async (req, res, next) => {
  try {
    const { query } = req.query;

    const searchTerm = query.trim();

    const searchResults = await Product.find({
      $or: [
        { productName: { $regex: searchTerm, $options: "i" } },
        { searchTags: { $regex: searchTerm, $options: "i" } },
      ],
    });

    res.status(200).json({
      message: "Searched product results",
      data: searchResults,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getProductByCategoryController = async (req, res, next) => {
  try {
    const categoryId = req.params.categoryId;

    const productsByCategory = await Product.find({
      categoryId: categoryId,
    })
      .select("productName")
      .sort({ order: 1 });

    res.status(200).json({
      message: "Products By category",
      data: productsByCategory,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const changeProductCategoryController = async (req, res, next) => {
  try {
    const { categoryId, productId } = req.params;

    const productFound = await Product.findById(productId);

    if (!productFound) {
      return next(appError("Product not found", 404));
    }

    productFound.categoryId = categoryId;
    await productFound.save();

    res.status(200).json({ message: "Product category changed" });
  } catch (err) {
    next(appError(err.message));
  }
};

const changeInventoryStatusController = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const productFound = await Product.findById(productId);

    if (!productFound) {
      return next(appError("Product not found", 404));
    }

    productFound.inventory = !productFound.inventory;
    await productFound.save();

    res.status(200).json({ message: "Product inventory status changed" });
  } catch (err) {
    next(appError(err.message));
  }
};

const updateProductOrderController = async (req, res, next) => {
  const { products } = req.body;

  try {
    for (const product of products) {
      await Product.findByIdAndUpdate(product.id, {
        order: product.order,
      });
    }

    res.status(200).json({ message: "Product order updated successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

//Variants

const addVariantToProductController = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { variantName, variantTypes } = req.body;

    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const formattedErrors = errors.array().reduce((acc, error) => {
        acc[error.param] = error.msg;
        return acc;
      }, {});
      return res.status(400).json({ errors: formattedErrors });
    }

    // Find the product by ID
    const product = await Product.findById(productId);
    if (!product) {
      return next(appError("Product not found", 404));
    }

    // Create new variant object
    const newVariant = {
      variantName,
      variantTypes,
    };

    // Add the new variant to the product's variants array
    product.variants.push(newVariant);

    // Save the updated product
    await product.save();

    res.status(201).json({
      message: "Variant added successfully",
      data: product,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const editVariantController = async (req, res, next) => {
  try {
    const { productId, variantId } = req.params;
    const { variantName, variantTypes } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return next(appError("Product not found", 404));
    }

    const variant = product.variants.id(variantId);
    if (!variant) {
      return next(appError("Variant not found", 404));
    }

    variant.variantName = variantName;
    variant.variantTypes = variantTypes;

    await product.save();

    res.status(200).json({
      message: "Variant updated successfully",
      data: product,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const deleteVariantTypeController = async (req, res, next) => {
  try {
    const { productId, variantId, variantTypeId } = req.params;

    const product = await Product.findById(productId);
    if (!product) {
      return next(appError("Product not found", 404));
    }

    const variant = product.variants.id(variantId);
    if (!variant) {
      return next(appError("Variant not found", 404));
    }

    const variantTypeIndex = variant.variantTypes.findIndex(
      (vt) => vt._id.toString() === variantTypeId
    );
    if (variantTypeIndex === -1) {
      return next(appError("Variant type not found", 404));
    }

    variant.variantTypes.splice(variantTypeIndex, 1);
    await product.save();

    res.status(200).json({
      message: "Variant type deleted successfully",
      data: product,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  getProductController,
  getAllProductsByMerchant,
  addProductController,
  editProductController,
  deleteProductController,
  addVariantToProductController,
  editVariantController,
  deleteVariantTypeController,
  searchProductController,
  getProductByCategoryController,
  changeProductCategoryController,
  changeInventoryStatusController,
  updateProductOrderController,
};
