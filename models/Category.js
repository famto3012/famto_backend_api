const mongoose = require("mongoose");

const categorySchema = mongoose.Schema({
  bussinessCategoryId: {
    type: mongoose.Types.ObjectId,
    ref: "BussinessCategory",
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
