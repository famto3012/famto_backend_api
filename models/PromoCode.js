const mongoose = require("mongoose");

const promoCodeSchema = new mongoose.Schema(
  {
    promoCode: {
      type: String,
      required: true,
    },
    promoType: {
      type: String,
      required: true,
      enum: ["Flat-discount", "Percentage-discount"], // assuming these are the only two types
    },
    discount: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
    },
    fromDate: {
      type: Date,
      required: true,
    },
    toDate: {
      type: Date,
      required: true,
    },
    maxDiscountValue: {
      type: Number,
      required: true,
    },
    minOrderAmount: {
      type: Number,
      required: true,
    },
    maxAllowedUsers: {
      type: Number,
      required: true,
    },
    appliedOn: {
      type: String,
      required: true,
      enum: ["Cart-value", "Delivery-Charge"], // assuming these are the only two options
    },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      required: true,
    },
    geofenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Geofence",
      required: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    status: {
      type: Boolean,
      default: true,
    },
    noOfUserUsed: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const PromoCode = mongoose.model("PromoCode", promoCodeSchema);
module.exports = PromoCode;
