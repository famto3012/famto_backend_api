const mongoose = require("mongoose");

const merchantDiscountSchema = new mongoose.Schema(
  {
    discountName: {
      type: String,
      required: true,
    },
    maxCheckoutValue: {
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
    status: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const MerchantDiscount = mongoose.model(
  "MerchantDiscount",
  merchantDiscountSchema
);
module.exports = MerchantDiscount;
