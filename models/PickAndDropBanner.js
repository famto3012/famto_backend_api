const mongoose = require("mongoose");

const pickAndDropBannerSchema = new mongoose.Schema(
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

const PickAndDropBanner = mongoose.model(
  "PickAndDropBanner",
  pickAndDropBannerSchema
);
module.exports = PickAndDropBanner;
