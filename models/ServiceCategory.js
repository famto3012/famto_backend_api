const mongoose = require("mongoose");

const ServiceCategorySchema = new mongoose.Schema(
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
    order: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const ServiceCategory = mongoose.model(
  "ServiceCategory",
  ServiceCategorySchema
);
module.exports = ServiceCategory;
