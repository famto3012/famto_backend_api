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
    geofenceId: {
      type: mongoose.Types.ObjectId,
      ref: "Geofence",
      required: true,
    },
    assignToMerchantId: {
      type: mongoose.Types.ObjectId,
      ref: "Merchant",
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

const Tax = mongoose.model("Tax", taxSchema);
module.exports = Tax;
