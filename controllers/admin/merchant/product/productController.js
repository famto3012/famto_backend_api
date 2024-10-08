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
const path = require("path");
const csvWriter = require("csv-writer").createObjectCsvWriter;
const fs = require("fs");

// ------------------------------------------------------
// ----------------For Merchant and Admin----------------
// ------------------------------------------------------

const addProductController = async (req, res, next) => {
  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.param] = error.msg;
    });

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
    const { productId } = req.params;

    const productFound = await Product.findById(productId);

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
    availableQuantity,
    alert,
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

    let productImageURL = productToUpdate?.productImageURL;

    if (req.file) {
      if (productImageURL) {
        await deleteFromFirebase(productImageURL);
      }

      productImageURL = await uploadToFirebase(req.file, "ProductImages");
    }

    const product = await Product.findByIdAndUpdate(
      productId,
      {
        productName: productName || null,
        productStatus: productStatus || null,
        price: price || null,
        minQuantityToOrder: minQuantityToOrder || null,
        maxQuantityPerOrder: maxQuantityPerOrder || null,
        costPrice: costPrice || null,
        sku: sku || null,
        discountId: discountId || null,
        oftenBoughtTogetherId: oftenBoughtTogetherId || null,
        preparationTime: preparationTime || null,
        searchTags: searchTags || null,
        description: description || null,
        longDescription: longDescription || null,
        type: type || null,
        productImageURL: productImageURL || null,
        vaiantStatus: vaiantStatus || null,
        availableQuantity: availableQuantity || null,
        alert: alert || null,
      },
      { new: true }
    );

    res
      .status(200)
      .json({ message: "Product updated successfully", data: product });
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

// -------------------------------------------------------
// ------------------------Variants-----------------------
// -------------------------------------------------------

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

    const { categoryId } = req.body;

    if (!categoryId) {
      return next(appError("Category Id is required", 400));
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
          // Use a unique key that includes SKU or other unique identifiers
          const productKey = `${row[
            "Product name"
          ]?.trim()}-${categoryId}-${row["SKU"]?.trim()}`;

          // Check if the product is already in the map
          if (!productsMap.has(productKey)) {
            productsMap.set(productKey, {
              productName: row["Product name"]?.trim(),
              price: parseFloat(row["Price"]?.trim()),
              minQuantityToOrder:
                parseInt(row["Min Quantity To Order"]?.trim()) || 0,
              maxQuantityPerOrder:
                parseInt(row["Max Quantity per Order"]?.trim()) || 0,
              costPrice: parseFloat(row["Cost price"]?.trim()),
              sku: row["SKU"]?.trim() || "",
              preparationTime: row["Preparation time"]?.trim() || "",
              description: row["Description"]?.trim() || "",
              longDescription: row["Long description"]?.trim() || "",
              type: row["Type"]?.trim(),
              categoryId,
              inventory: row["Inventory"]?.trim().toLowerCase() || true,
              availableQuantity:
                parseInt(row["Available Quantity"]?.trim()) || 0,
              alert: parseInt(row["Alert"]?.trim()) || 0,
              variants: [],
            });
          }

          // Get the existing product
          const product = productsMap.get(productKey);

          // Only add the variant if `Variant name`, `Variant Type name`, and `Variant Type price` are available
          const variantName = row["Variant name"]?.trim();
          const variantTypeName = row["Variant Type name"]?.trim();
          const variantTypePrice = parseFloat(
            row["Variant Type price"]?.trim()
          );

          if (variantName && variantTypeName && variantTypePrice) {
            const variant = {
              variantName,
              variantTypes: [
                {
                  typeName: variantTypeName,
                  price: variantTypePrice,
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
        }
      })
      .on("end", async () => {
        try {
          const productPromises = Array.from(productsMap.values()).map(
            async (productData) => {
              const existingProduct = await Product.findOne({
                productName: productData.productName,
                categoryId: productData.categoryId,
                sku: productData.sku, // Ensure SKU is also checked
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

          res.status(200).json({
            message: "Products added/updated successfully.",
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

const downloadProductSampleCSVController = async (req, res, next) => {
  try {
    // Define the path to your sample CSV file
    const filePath = path.join(
      __dirname,
      "../../../../sample_CSV/sample_CSV.csv"
    );

    // Define the headers and data for the CSV
    const csvHeaders = [
      { id: "productName", title: "Product name" },
      { id: "price", title: "Price" },
      { id: "minQuantityToOrder", title: "Min Quantity To Order" },
      { id: "maxQuantityPerOrder", title: "Max Quantity per Order" },
      { id: "costPrice", title: "Cost price" },
      { id: "sku", title: "SKU" },
      { id: "preparationTime", title: "Preparation time" },
      { id: "description", title: "Description" },
      { id: "longDescription", title: "Long description" },
      { id: "type", title: "Type" },
      { id: "inventory", title: "Inventory" },
      { id: "availableQuantity", title: "Available Quantity" },
      { id: "alert", title: "Alert" },
      { id: "variantName", title: "Variant name" },
      { id: "typeName", title: "Variant Type name" },
      { id: "variantTypePrice", title: "Variant Type price" },
    ];

    const csvData = [
      {
        productName: "Product 1",
        price: "100",
        minQuantityToOrder: "1",
        maxQuantityPerOrder: "20",
        costPrice: "100",
        sku: "SKU12345",
        preparationTime: "30",
        description: "Description",
        longDescription: "Long description",
        type: "Veg / Non-veg",
        inventory: "TRUE / FALSE",
        availableQuantity: "20",
        alert: "10",
        variantName: "Size",
        typeName: "Medium",
        variantTypePrice: "150",
      },
      {
        productName: "Product 2",
        price: "100",
        minQuantityToOrder: "1",
        maxQuantityPerOrder: "20",
        costPrice: "100",
        sku: "SKU12345",
        preparationTime: "30",
        description: "Description",
        longDescription: "Long description",
        type: "Veg / Non-veg",
        inventory: "TRUE / FALSE",
        availableQuantity: "20",
        alert: "10",
        variantName: "Colour",
        typeName: "Black",
        variantTypePrice: "150",
      },
    ];

    // Create a new CSV writer
    const writer = csvWriter({
      path: filePath,
      header: csvHeaders,
    });

    // Write the data to the CSV file
    await writer.writeRecords(csvData);

    // Send the CSV file as a response for download
    res.download(filePath, "Product_sample.csv", (err) => {
      if (err) {
        next(err);
      }
    });
  } catch (error) {
    res.status(500).send("Error processing the CSV file");
  }
};

const downloadCobminedProductAndCategoryController = async (req, res, next) => {
  try {
    const { merchantId } = req.body;

    // Find all categories and related products for the given merchant
    const categories = await Category.find({ merchantId })
      .populate("businessCategoryId", "title")
      .lean();

    const formattedResponse = [];

    for (const category of categories) {
      const products = await Product.find({ categoryId: category._id }).lean();

      products.forEach((product) => {
        const variants =
          product.variants.length > 0
            ? product.variants
            : [
                {
                  variantName: "-",
                  variantTypes: [{ typeName: "-", price: "-" }],
                },
              ];

        variants.forEach((variant) => {
          const variantTypes =
            variant.variantTypes.length > 0
              ? variant.variantTypes
              : [{ typeName: "-", price: "-" }];

          variantTypes.forEach((type) => {
            formattedResponse.push({
              businessCategory: category.businessCategoryId?.title || "-",
              categoryName: category.categoryName || "-",
              categoryDescription: category.description || "-",
              categoryType: category.type || "-",
              categoryImage: category.categoryImageURL || "-",
              categoryStatus: category.status || "-",
              productName: product.productName || "-",
              productPrice: product.price || "-",
              minQuantityToOrder: product.minQuantityToOrder || "-",
              maxQuantityPerOrder: product.maxQuantityPerOrder || "-",
              costPrice: product.costPrice || "-",
              sku: product.sku || "-",
              preparationTime: product.preparationTime || "-",
              description: product.description || "-",
              longDescription: product.longDescription || "-",
              type: product.type || "-",
              productImageURL: product.productImageURL || "-",
              inventory: product.inventory || "-",
              availableQuantity: product.availableQuantity || "-",
              alert: product.alert || "-",
              variantName: variant.variantName || "-",
              typeName: type.typeName || "-",
              price: type.price || "-",
            });
          });
        });
      });
    }

    const filePath = path.join(
      __dirname,
      "../../../../sample_CSV/sample_CSV.csv"
    );

    const csvHeaders = [
      { id: "businessCategory", title: "Business category name" },
      { id: "categoryName", title: "Category name" },
      { id: "categoryDescription", title: "category description" },
      { id: "categoryType", title: "Category type" },
      { id: "categoryImage", title: "category Image" },
      { id: "categoryStatus", title: "category status" },
      { id: "productName", title: "Poduct name" },
      { id: "productPrice", title: "Product price" },
      { id: "minQuantityToOrder", title: "Min quantity to order" },
      { id: "maxQuantityPerOrder", title: "Max quantity to order" },
      { id: "costPrice", title: "Cost price" },
      { id: "sku", title: "SKU" },
      { id: "preparationTime", title: "Preperation time" },
      { id: "description", title: "Product description" },
      { id: "longDescription", title: "Product long description" },
      { id: "type", title: "Product type" },
      { id: "productImageURL", title: "Product Image" },
      { id: "inventory", title: "Inventory" },
      { id: "availableQuantity", title: "Available quantity" },
      { id: "alert", title: "Alert" },
      { id: "variantName", title: "Variant name" },
      { id: "typeName", title: "Variant type name" },
      { id: "price", title: "variant price" },
    ];

    const writer = csvWriter({
      path: filePath,
      header: csvHeaders,
    });

    await writer.writeRecords(formattedResponse);

    // Add UTF-8 BOM to the CSV file
    const bom = "\uFEFF"; // BOM character
    const csvContent = fs.readFileSync(filePath, "utf8");
    fs.writeFileSync(filePath, bom + csvContent, { encoding: "utf8" });

    res.status(200).download(filePath, "Combined_Product_Data.csv", (err) => {
      if (err) {
        next(err);
      }
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
  downloadProductSampleCSVController,
  downloadCobminedProductAndCategoryController,
};
