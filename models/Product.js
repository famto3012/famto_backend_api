const mongoose = require("mongoose");

// Define the VariantType schema
const variantTypeSchema = mongoose.Schema(
  {
    typeName: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
  },
  {
    _id: false,
  }
);

// Define the Variant schema
const variantSchema = mongoose.Schema(
  {
    variantName: {
      type: String,
      required: true,
    },
    variantTypes: [variantTypeSchema], // Embed VariantType schema
  },
  {
    _id: false,
  }
);

// Define the ProductDetail schema
const productDetailSchema = mongoose.Schema(
  {
    inventory: {
      type: Boolean,
      default: false,
    },
    availableQuantity: {
      type: Number,
      required: true,
    },
    alert: {
      type: Number,
      required: true,
    },
    variants: [variantSchema],
  },
  {
    timestamps: true,
  },
  {
    _id: false,
  }
);

// Define the Product schema
const productSchema = mongoose.Schema(
  {
    productName: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    minQuantityToOrder: {
      type: Number,
      required: true,
    },
    maxQuantityPerOrder: {
      type: Number,
      required: true,
    },
    costPrice: {
      type: Number,
      required: true,
    },
    sku: {
      type: String,
      required: true,
    },
    discountId: {
      type: mongoose.Schema.ObjectId,
      ref: "ProductDiscount",
      default: null,
    },
    oftenBoughtTogetherId: {
      type: mongoose.Schema.ObjectId,
      ref: "Product",
      default: null,
    },
    preperationTime: {
      type: String,
      required: true,
    },
    searchTags: {
      type: [String],
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    longDescription: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
    productImageURL: {
      type: String,
      required: true,
    },
    categoryId: {
      type: mongoose.Schema.ObjectId,
      ref: "Category",
    },
    vaiantStatus: {
      type: Boolean,
      default: null,
    },
    productStatus: {
      type: Boolean,
      required: true,
    },

    productDetails: productDetailSchema,
  },
  {
    timestamps: true,
  }
);

const Product = mongoose.model("Product", productSchema);
module.exports = Product;
