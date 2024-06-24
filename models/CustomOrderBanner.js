const mongoose = require('mongoose');

const customOrderBannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
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
},
  {
    timestamps: true,
  }
);

const CustomOrderBanner = mongoose.model('CustomOrderBanner', customOrderBannerSchema);
module.exports = CustomOrderBanner;
