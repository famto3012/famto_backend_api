const mongoose = require("mongoose");

const taxSchema = new mongoose.Schema(
  {
    taxName: {
      type: String,
      required: true,
    },
    tax: {
      type: Number,
      required: true,
    },
    taxType: {
      type: String,
      enum: ["Fixed-amount", "Percentage"],
      required: true,
    },
    geofences: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Geofence",
        required: true,
      },
    ],
    assignToBusinessCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessCategory",
      default: null,
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

const Tax = mongoose.model("Tax", taxSchema);
module.exports = Tax;
