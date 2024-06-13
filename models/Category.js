const mongoose = require("mongoose");

const categorySchema = mongoose.Schema({
  bussinessCategoryId: {
    type: mongoose.Types.ObjectId,
    ref: "BussnessCategory",
  },
  merchantId: {
    type: mongoose.Types.ObjectId,
    ref: "Admin",
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
