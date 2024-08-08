const mongoose = require("mongoose");

const managerSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      default: "Manager",
      required: true,
    },
    merchants: {
      type: String,
      ref: "Merchant",
      required: true,
    },
    geofenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Geofence",
      required: true,
    },
    viewCustomers: {
      type: Boolean,
      default: false,
    },
    domain: {
      type: String,
      enum: ["Order", "Finance", "Marketing"],
      required: true,
    },
  },
  {
    timestamp: true,
  }
);

const Manager = mongoose.model("Manager", managerSchema);
module.exports = Manager;
