const mongoose = require("mongoose");

const BusinessCategorySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    geofenceId: {
      type: mongoose.Schema.ObjectId,
      ref: "Geofence",
      required: true,
    },
    bannerImageURL: {
      type: String,
      required: true,
    },
    status: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const BusinessCategory = mongoose.model(
  "BusinessCategory",
  BusinessCategorySchema
);
module.exports = BusinessCategory;
