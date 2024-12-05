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
      enum: ["Flat-discount", "Percentage-discount"],
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
      enum: ["Cart-value", "Delivery-charge"],
    },
    applicationMode: {
      type: String,
      required: true,
      enum: ["Public", "Hidden"],
    },
    merchantId: [
      {
        type: String,
        ref: "Merchant",
      },
    ],
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
    deliveryMode: {
      type: String,
      required: true,
      enum: ["Home Delivery", "Take Away", "Pick and Drop", "Custom Order"],
    },
  },
  {
    timestamps: true,
  }
);

const PromoCode = mongoose.model("PromoCode", promoCodeSchema);
module.exports = PromoCode;
