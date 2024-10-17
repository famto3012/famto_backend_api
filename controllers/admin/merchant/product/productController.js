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
const BusinessCategory = require("../../../../models/BusinessCategory");

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
      .select("productName inventory")
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

const downloadProductSampleCSVController = async (req, res, next) => {
  try {
    // Define the path to your sample CSV file
    const filePath = path.join(
      __dirname,
      "../../../../sample_CSV/sample_CSV.csv"
    );

    // Define the headers and data for the CSV
    const csvHeaders = [
      { id: "businessCategoryName", title: "Business Category Name*" },
      { id: "categoryName", title: "Category Name*" },
      { id: "categoryType", title: "Category Type*" },
      { id: "productName", title: "Product Name*" },
      { id: "price", title: "Product Price*" },
      { id: "costPrice", title: "Cost Price*" },
      { id: "productType", title: "Product Type*" },
      { id: "minQuantityToOrder", title: "Min Quantity To Order" },
      { id: "maxQuantityPerOrder", title: "Max Quantity Per Order" },
      { id: "sku", title: "SKU" },
      { id: "preparationTime", title: "Preparation Time" },
      { id: "description", title: "Description" },
      { id: "longDescription", title: "Long Description" },
      { id: "availableQuantity", title: "Available Quantity" },
      { id: "alert", title: "Alert" },
      { id: "variantName", title: "Variant Name" },
      { id: "typeName", title: "Variant Type Name" },
      { id: "variantTypePrice", title: "Variant Type Price" },
    ];

    const csvData = [
      {
        businessCategoryName: "Business category",
        categoryName: "Category 1",
        categoryType: "Veg / Non-veg / Both",
        status: "TRUE / FALSE",
        productName: "Product 1",
        price: "100",
        costPrice: "100",
        productType: "Veg / Non-veg / Other",
        minQuantityToOrder: "1",
        maxQuantityPerOrder: "20",
        sku: "SKU12345",
        preparationTime: "30",
        description: "Description",
        longDescription: "Long Description",
        availableQuantity: "20",
        alert: "10",
        variantName: "Size",
        typeName: "Medium",
        variantTypePrice: "150",
      },
      {
        businessCategoryName: "Business category",
        categoryName: "Category 2",
        categoryType: "Veg / Non-veg / Both",
        status: "TRUE / FALSE",
        productName: "Product 2",
        price: "200",
        costPrice: "200",
        productType: "Veg / Non-veg / Other",
        minQuantityToOrder: "1",
        maxQuantityPerOrder: "20",
        sku: "SKU12345",
        preparationTime: "30",
        description: "Description",
        longDescription: "Long Description",
        availableQuantity: "20",
        alert: "10",
        variantName: "Size",
        typeName: "Medium",
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
              categoryType: category.type || "-",
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
      { id: "businessCategory", title: "Business Category Name*" },
      { id: "categoryName", title: "Category Name*" },
      { id: "categoryType", title: "Category Type*" },
      { id: "categoryStatus", title: "Category Status*" },
      { id: "productName", title: "Product Name*" },
      { id: "productPrice", title: "Product Price*" },
      { id: "costPrice", title: "Cost Price*" },
      { id: "type", title: "Product Type*" },
      { id: "minQuantityToOrder", title: "Min Quantity To Order" },
      { id: "maxQuantityPerOrder", title: "Max quantity Per Order" },
      { id: "sku", title: "SKU" },
      { id: "preparationTime", title: "Preperation Time" },
      { id: "description", title: "Description" },
      { id: "longDescription", title: "Long Description" },
      { id: "productImageURL", title: "Product Image" },
      { id: "inventory", title: "Inventory" },
      { id: "availableQuantity", title: "Available quantity" },
      { id: "alert", title: "Alert" },
      { id: "variantName", title: "Variant Name" },
      { id: "typeName", title: "Variant Type Name" },
      { id: "price", title: "Variant Price" },
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

const addCategoryAndProductsFromCSVController = async (req, res, next) => {
  try {
    const { merchantId } = req.body;

    if (!req.file) {
      return next(appError("CSV file is required", 400));
    }

    // Upload the CSV file to Firebase and get the download URL
    const fileUrl = await uploadToFirebase(req.file, "csv-uploads");

    const categoriesMap = new Map(); // To store categories and their products

    // Download the CSV data from Firebase Storage
    const response = await axios.get(fileUrl);
    const csvData = response.data;

    // Create a readable stream from the CSV data
    const stream = Readable.from(csvData);

    // Parse the CSV data
    stream
      .pipe(csvParser())
      .on("data", (row) => {
        console.log("Row data:", row); // Log the entire row data to check values

        const isRowEmpty = Object.values(row).every(
          (value) => value.trim() === ""
        );

        if (!isRowEmpty) {
          const businessCategoryName = row["Business Category Name*"]?.trim();
          const categoryName = row["Category Name*"]?.trim();
          const productName = row["Product Name*"]?.trim();
          const variantKey = row["Variant Name"]?.trim();
          const variantTypeKey = row["Variant Type Name"]?.trim();
          const categoryKey = `${merchantId}-${businessCategoryName}-${categoryName}-${productName}-${variantKey}-${variantTypeKey}`; // Updated to include businessCategoryName

          if (!categoriesMap.has(categoryKey)) {
            categoriesMap.set(categoryKey, {
              categoryData: {
                merchantId,
                businessCategoryName, // Ensure businessCategoryName is set correctly
                categoryName,
                type: row["Category Type*"]?.trim(),
                status: true,
              },
              products: [],
            });
          }

          console.log(
            "Parsed Category Data:",
            categoriesMap.get(categoryKey).categoryData
          );

          // Add products under the relevant category
          const categoryEntry = categoriesMap.get(categoryKey);

          const product = {
            productName: row["Product Name*"]?.trim(),
            price: parseFloat(row["Product Price*"]?.trim()),
            minQuantityToOrder:
              parseInt(row["Min Quantity To Order"]?.trim()) || 0,
            maxQuantityPerOrder:
              parseInt(row["Max Quantity Per Order"]?.trim()) || 0,
            costPrice: parseFloat(row["Cost Price*"]?.trim()),
            sku: row["SKU"]?.trim() || "",
            preparationTime: row["Preparation Time"]?.trim() || "",
            description: row["Description"]?.trim() || "",
            longDescription: row["Long Description"]?.trim() || "",
            type: row["Product Type*"]?.trim(),
            inventory: true,
            availableQuantity: parseInt(row["Available Quantity"]?.trim()) || 0,
            alert: parseInt(row["Alert"]?.trim()) || 0,
            variants: [],
          };

          console.log("Parsed Product Data:", product);

          // Add variants to the product
          const variantName = row["Variant Name"]?.trim();
          const variantTypeName = row["Variant Type Name"]?.trim();
          const variantTypePrice = parseFloat(
            row["Variant Type Price"]?.trim()
          );
          console.log("variantName", variantName)
          console.log("variantTypeName", variantTypeName)
          console.log("variantTypePrice", variantTypePrice)

          if (variantName && variantTypeName && variantTypePrice !== null && variantTypePrice !== undefined) {
            const variant = {
              variantName,
              variantTypes: [
                { typeName: variantTypeName, price: variantTypePrice },
              ],
            };

            console.log("Parsed Variant Data:", variant);

            const existingVariant = product.variants.find(
              (v) => v.variantName === variant.variantName
            );

            if (existingVariant) {
              existingVariant.variantTypes.push(...variant.variantTypes);
            } else {
              product.variants.push(variant);
            }
          }

          categoryEntry.products.push(product);
        }
      })
      .on("end", async () => {
        try {
          for (const [
            _,
            { categoryData, products },
          ] of categoriesMap.entries()) {
            console.log("Final Category Data to Save:", categoryData);
            console.log("Associated Products:", products);

            // Find or create the business category using businessCategoryName
            const businessCategoryFound = await BusinessCategory.findOne({
              title: categoryData.businessCategoryName,
            });

            if (!businessCategoryFound) {
              console.log(
                `Business category not found for ${categoryData.businessCategoryName}`
              );
              continue; // Skip this category if the business category does not exist
            }

            console.log(
              `Found business category: ${businessCategoryFound.title}`
            );

            // Add business category ID to category data
            categoryData.businessCategoryId = businessCategoryFound._id;

            // Check if the category already exists
            const existingCategory = await Category.findOne({
              merchantId,
              categoryName: categoryData.categoryName,
            });

            let newCategory;
            if (existingCategory) {
              console.log(
                `Updating existing category: ${categoryData.categoryName}`
              );
              newCategory = await Category.findByIdAndUpdate(
                existingCategory._id,
                { $set: categoryData },
                { new: true }
              );
            } else {
              console.log(
                `Creating new category: ${categoryData.categoryName}`
              );
              // Get the last category order
              let lastCategory = await Category.findOne().sort({ order: -1 });
              let newOrder = lastCategory ? lastCategory.order + 1 : 1;

              categoryData.order = newOrder++;
              newCategory = new Category(categoryData);
              await newCategory.save();
            }

            // Now, process products for the category
            const productPromises = products.map(async (productData) => {
              productData.categoryId = newCategory._id;
              console.log("Product Data to Save/Update:", productData);

              const existingProduct = await Product.findOne({
                productName: productData.productName,
                categoryId: productData.categoryId,
                sku: productData.sku,
              });

              if (existingProduct) {
                console.log(`Updating product: ${productData.productName}`);
                await Product.findByIdAndUpdate(
                  existingProduct._id,
                  { ...productData, order: existingProduct.order },
                  { new: true }
                );
              } else {
                console.log(`Creating new product: ${productData.productName}`);
                // Get the last product order
                let lastProduct = await Product.findOne().sort({ order: -1 });
                let newOrder = lastProduct ? lastProduct.order + 1 : 1;

                productData.order = newOrder++;
                const newProduct = new Product(productData);
                await newProduct.save();
              }
            });

            await Promise.all(productPromises);
          }

          // Fetch all categories after adding, ordered by the 'order' field in ascending order
          const allCategories = await Category.find({ merchantId })
            .select("categoryName status")
            .sort({ order: 1 });

          res.status(200).json({
            message: "Categories and products added successfully.",
            data: allCategories,
          });
        } catch (err) {
          console.error("Error processing categories and products:", err);
          next(appError(err.message));
        } finally {
          // Delete the file from Firebase after processing
          await deleteFromFirebase(fileUrl);
        }
      })
      .on("error", (error) => {
        console.error("Error reading CSV data:", error);
        next(appError(error.message));
      });
  } catch (err) {
    console.error("General error:", err);
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
  downloadProductSampleCSVController,
  downloadCobminedProductAndCategoryController,
  addCategoryAndProductsFromCSVController,
};
