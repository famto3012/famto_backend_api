const mongoose = require("mongoose");

const appBannerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    merchantId: {
      type: String,
      ref: "Merchant",
      required: true,
    },
    geofenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Geofence",
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

const AppBanner = mongoose.model("AppBanner", appBannerSchema);
module.exports = AppBanner;
