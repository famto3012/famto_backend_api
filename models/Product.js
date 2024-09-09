const mongoose = require("mongoose");

// Define the VariantType schema
const variantTypeSchema = mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
    },
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
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
    },
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
      default: 0,
    },
    maxQuantityPerOrder: {
      type: Number,
      default: 0,
    },
    costPrice: {
      type: Number,
      required: true,
    },
    sku: {
      type: String,
      default: null,
    },
    discountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductDiscount",
      default: null,
    },
    oftenBoughtTogetherId: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        default: null,
      },
    ],
    preparationTime: {
      type: String,
      default: null,
    },
    searchTags: {
      type: [String],
      // required: true,
    },
    description: {
      type: String,
      default: null,
    },
    longDescription: {
      type: String,
      default: null,
    },
    type: {
      type: String,
      enum: ["Veg", "Non-veg", "Other"],
      required: true,
    },
    productImageURL: {
      type: String,
      default: null,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    inventory: {
      type: Boolean,
      default: true,
    },
    availableQuantity: {
      type: Number,
      default: null,
    },
    alert: {
      type: Number,
      default: null,
    },
    order: {
      type: Number,
      required: true,
    },
    variants: [variantSchema],
  },
  {
    timestamps: true,
  }
);

// const VariantType = mongoose.model("VariantType", variantTypeSchema);
const Product = mongoose.model("Product", productSchema);
module.exports = Product;
