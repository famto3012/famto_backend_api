const mongoose = require("mongoose");

const HomeScreenRevenueDataSchema = new mongoose.Schema(
  {
    sales: {
      type: Number,
      default: 0,
    },
    merchants: {
      type: Number,
      default: 0,
    },
    commission: {
      type: Number,
      default: 0,
    },
    subscription: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const HomeScreenRevenueData = mongoose.model(
  "HomeScreenRevenueData",
  HomeScreenRevenueDataSchema
);

module.exports = HomeScreenRevenueData;