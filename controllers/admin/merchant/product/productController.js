const { validationResult } = require("express-validator");
const Product = require("../../../../models/Product");
const appError = require("../../../../utils/appError");
const {
  uploadToFirebase,
  deleteFromFirebase,
} = require("../../../../utils/imageOperation");
const Category = require("../../../../models/Category");
const axios = require("axios");
const { Readable } = require("stream");
const csvParser = require("csv-parser");

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
    oftenBoughtTogetherId = [],
    preparationTime,
    searchTags,
    description,
    longDescription,
    type,
    availableQuantity,
    alert,
  } = req.body;

  console.log(req.body.searchTags);

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
      oftenBoughtTogetherId,
      preparationTime,
      searchTags,
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

    const productFound = await Product.findById(productId);
    // .populate("oftenBoughtTogetherId", "productName")
    // .populate("discountId", "discountName")
    // .populate("categoryId", "categoryName");

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
    oftenBoughtTogetherId = [],
    preparationTime,
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
    const { productId } = req.params;

    const productToUpdate = await Product.findById(productId);

    if (!productToUpdate) {
      return next(appError("Product not found", 404));
    }

    let productImageURL = productToUpdate.productImageURL;

    if (req.file) {
      await deleteFromFirebase(productImageURL);
      productImageURL = await uploadToFirebase(req.file, "ProductImages");
    }

    await Product.findByIdAndUpdate(
      productId,
      {
        productName,
        productStatus,
        price,
        minQuantityToOrder,
        maxQuantityPerOrder,
        costPrice,
        sku,
        discountId: discountId || null,
        oftenBoughtTogetherId,
        preparationTime,
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

// const deleteVariantTypeController = async (req, res, next) => {
//   try {
//     const { productId, variantId, variantTypeId } = req.params;

//     const product = await Product.findById(productId);
//     if (!product) {
//       return next(appError("Product not found", 404));
//     }

//     const variant = product.variants.id(variantId);
//     if (!variant) {
//       return next(appError("Variant not found", 404));
//     }

//     const variantTypeIndex = variant.variantTypes.findIndex(
//       (vt) => vt._id.toString() === variantTypeId
//     );
//     if (variantTypeIndex === -1) {
//       return next(appError("Variant type not found", 404));
//     }

//     variant.variantTypes.splice(variantTypeIndex, 1);
//     await product.save();

//     res.status(200).json({
//       message: "Variant type deleted successfully",
//       data: product,
//     });
//   } catch (err) {
//     next(appError(err.message));
//   }
// };

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

    // If the variant has only one variant type, delete the entire variant
    if (variant.variantTypes.length === 1) {
      product.variants.pull(variantId);
    } else {
      // Otherwise, just delete the specified variant type
      variant.variantTypes.splice(variantTypeIndex, 1);
    }

    await product.save();

    res.status(200).json({
      message: "Variant type deleted successfully",
      data: product,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const addProductFromCSVController = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(appError("CSV file is required", 400));
    }

    // Upload the CSV file to Firebase and get the download URL
    const fileUrl = await uploadToFirebase(req.file, "csv-uploads");

    const productsMap = new Map();

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
          const productKey = `${row.productName}-${row.categoryId}`;

          // Check if the product is already in the map
          if (!productsMap.has(productKey)) {
            productsMap.set(productKey, {
              productName: row["Product name"]?.trim(),
              price: parseFloat(row["Price"].trim()),
              minQuantityToOrder: parseInt(
                row["Min Quantity To Order"]?.trim()
              ),
              maxQuantityPerOrder: parseInt(
                row["Max Quantity per Order"]?.trim()
              ),
              costPrice: parseFloat(row["Cost price"]?.trim()),
              sku: row["SKU"]?.trim(),
              preparationTime: row["Preparation time"]?.trim(),
              description: row["Description"]?.trim(),
              longDescription: row["Long description"]?.trim(),
              type: row["Type"]?.trim(),
              categoryId: row["Category Id"]?.trim(),
              inventory: row["Inventory"].trim().toLowerCase() === "true",
              availableQuantity: parseInt(row["Available Quantity"]?.trim()),
              alert: parseInt(row["Alert"]?.trim()),
              variants: [],
            });
          }

          // Get the existing product
          const product = productsMap.get(productKey);

          // Add or update the variant for the product
          const variant = {
            variantName: row["Variant name"]?.trim(),
            variantTypes: [
              {
                typeName: row["Variant Type name"]?.trim(),
                price: parseFloat(row["Variant Type price"]?.trim()),
              },
            ],
          };

          // Check if the variant already exists
          const existingVariant = product.variants.find(
            (v) => v.variantName === variant.variantName
          );

          if (existingVariant) {
            // Add new variant types to the existing variant
            existingVariant.variantTypes.push(...variant.variantTypes);
          } else {
            // Add new variant to the product
            product.variants.push(variant);
          }

          // Update the map with the modified product
          productsMap.set(productKey, product);
        }
      })
      .on("end", async () => {
        try {
          const productPromises = Array.from(productsMap.values()).map(
            async (productData) => {
              const existingProduct = await Product.findOne({
                productName: productData.productName,
                categoryId: productData.categoryId,
              });

              if (existingProduct) {
                // Replace existing product data with the new data from the CSV
                await Product.findByIdAndUpdate(
                  existingProduct._id,
                  {
                    ...productData,
                    order: existingProduct.order,
                  },
                  {
                    new: true,
                  }
                );
              } else {
                // Get the last product order
                let lastProduct = await Product.findOne().sort({ order: -1 });
                let newOrder = lastProduct ? lastProduct.order + 1 : 1;

                // Set the order and create the new product
                productData.order = newOrder++;
                const product = new Product(productData);
                await product.save();
              }
            }
          );

          await Promise.all(productPromises);

          res.status(201).json({
            message: "Products added/updated successfully.",
            data: Array.from(productsMap.values()),
          });
        } catch (err) {
          next(appError(err.message));
        } finally {
          // Delete the file from Firebase after processing
          await deleteFromFirebase(fileUrl);
        }
      })
      .on("error", (err) => {
        next(appError(err.message));
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
  addProductFromCSVController,
};
