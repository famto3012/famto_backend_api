const mongoose = require("mongoose");

const categorySchema = mongoose.Schema(
  {
    businessCategoryId: {
      type: mongoose.Types.ObjectId,
      ref: "BusinessCategory",
    },
    merchantId: {
      type: mongoose.Types.ObjectId,
      ref: "Merchant",
    },
    categoryName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["Veg", "Non-veg", "Both"],
      default: "veg",
      required: true,
    },
    categoryImageURL: {
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

const Category = mongoose.model("Category", categorySchema);
module.exports = Category;
