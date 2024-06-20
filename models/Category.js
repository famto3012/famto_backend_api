const mongoose = require("mongoose");

const categorySchema = mongoose.Schema({
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
    required: true,
  },
  categoryImageURL: {
    type: String,
    required: true,
  },
});

const Category = mongoose.model("Category", categorySchema);
module.exports = Category;
