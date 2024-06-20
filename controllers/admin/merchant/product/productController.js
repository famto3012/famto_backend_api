const { validationResult } = require("express-validator");
const Product = require("../../../../models/Product");
const appError = require("../../../../utils/appError");
const {
  uploadToFirebase,
  deleteFromFirebase,
} = require("../../../../utils/imageOperation");

const getProductController = async (req, res, next) => {
  try {
    const productId = req.params.productId;

    const productFound = await Product.findById(productId).populate(
      "oftenBoughtTogether"
    );

    if (!productFound) {
      return next(appError("Produ t not found", 404));
    }

    res.status(200).json({ message: "Product data", data: productFound });
  } catch (err) {
    next(appError(err.message));
  }
};

const addProductController = async (req, res, next) => {
  const {
    productName,
    productStatus,
    price,
    minQuantityToOrder,
    maxQuantityPerOrder,
    costPrice,
    sku,
    discountId,
    oftenBoughtTogether,
    preperationTime,
    searchTags,
    description,
    longDescription,
    type,
    categoryId,
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
    const existingProduct = await Product.findOne({ productName, categoryId });

    if (existingProduct) {
      formattedErrors.productName = "Product already exists";
      return res.status(409).json({ errors: formattedErrors });
    }

    let productImageURL = "";

    if (req.file) {
      productImageURL = await uploadToFirebase(req.file, "ProductImages");
    }

    const newProduct = await Product.create({
      productName,
      productStatus,
      price,
      minQuantityToOrder,
      maxQuantityPerOrder,
      costPrice,
      sku,
      discountId,
      oftenBoughtTogether,
      preperationTime,
      searchTags,
      description,
      longDescription,
      type,
      productImageURL,
      categoryId,
    });

    if (!newProduct) {
      return next(appError("Error in creating new Product"));
    }

    res.status(200).json({ message: "Product added successfully" });
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
    oftenBoughtTogether,
    preperationTime,
    searchTags,
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
        discountId,
        oftenBoughtTogether,
        preperationTime,
        searchTags,
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

const updateProductDetailsController = async (req, res, next) => {
  const { productName, price, description, productDetails } = req.body;

  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const productId = req.params.productId;

    const productFound = await Product.findById(productId);

    if (!productFound) {
      return next(appError("Product not found", 404));
    }

    // Prepare the update object
    const updateFields = {};
    if (productName) updateFields.productName = productName;
    if (price) updateFields.price = price;
    if (description) updateFields.description = description;
    if (productDetails) updateFields.productDetails = productDetails;

    // Save the updated product details
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      {
        $set: updateFields,
      },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return next(appError("Error in updating product"));
    }

    res.status(200).json({
      message: "Product details updated successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const deleteProductDetailsController = async (req, res, next) => {
  try {
    const productId = req.params.productId;

    const productFound = await Product.findById(productId);

    if (!productFound) {
      return next(appError("Product not found", 404));
    }

    // Set productDetails to null or empty object based on your requirement
    productFound.productDetails = {
      productStatus: false,
      availableQuantity: 0,
      alert: 0,
      variants: [],
    };

    // Save the updated product
    const updatedProduct = await productFound.save();

    if (!updatedProduct) {
      return next(appError("Error in deleting product details"));
    }

    res.status(200).json({
      message: "Product details deleted successfully",
    });
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

const getProductByCategory = async (req, res, next) => {
  try {
    const categoryId = req.params.categoryId;

    const productsByCategory = await Product.find({ categoryId: categoryId });

    res.status(200).json({
      message: "Products By category",
      data: productsByCategory,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  getProductController,
  addProductController,
  editProductController,
  deleteProductController,
  updateProductDetailsController,
  deleteProductDetailsController,
  searchProductController,
  getProductByCategory,
};
