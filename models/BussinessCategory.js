const mongoose = require("mongoose");

const BussinessCategorySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    geofence: {
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

const BussinessCategory = mongoose.model(
  "BussinessCategory",
  BussinessCategorySchema
);
module.exports = BussinessCategory;
