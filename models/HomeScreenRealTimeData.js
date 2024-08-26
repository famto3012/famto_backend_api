const mongoose = require("mongoose");

const HomeScreenRealTimeDataSchema = new mongoose.Schema(
  {
    order: {
      pending: {
        type: Number,
        default: 0,
      },
      ongoing: {
        type: Number,
        default: 0,
      },
      completed: {
        type: Number,
        default: 0,
      },
      cancelled: {
        type: Number,
        default: 0,
      },
    },

    merchants: {
      open: {
        type: Number,
        default: 0,
      },
      closed: {
        type: Number,
        default: 0,
      },
      active: {
        type: Number,
        default: 0,
      },
      inactive: {
        type: Number,
        default: 0,
      },
    },

    deliveryAgent: {
      free: {
        type: Number,
        default: 0,
      },
      active: {
        type: Number,
        default: 0,
      },
      inactive: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);

const HomeScreenRealTimeData = mongoose.model(
  "HomeScreenRealTimeData",
  HomeScreenRealTimeDataSchema
);

module.exports = HomeScreenRealTimeData;
