const mongoose = require("mongoose");

const productDiscountSchema = new mongoose.Schema(
  {
    discountName: {
      type: String,
      required: true,
    },
    maxAmount: {
      type: Number,
      required: true,
    },
    discountType: {
      type: String,
      enum: ["Flat-discount", "Percentage-discount"],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    validFrom: {
      type: Date,
      required: true,
    },
    validTo: {
      type: Date,
      required: true,
    },
    geofenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Geofence",
      required: true,
    },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    onAddOn: {
      type: Boolean,
      required: true,
      default: true,
    },
    status: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const ProductDiscount = mongoose.model(
  "ProductDiscount",
  productDiscountSchema
);
module.exports = ProductDiscount;
