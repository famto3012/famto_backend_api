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
      enum: ["Role1", "Role2"], //INFO: Edit for adding additional roles
      required: true,
    },
    merchants: {
      type: String,
      enum: ["Merchant1", "Merchant2"], //INFO: Edit for adding additional merchnats
      required: true,
    },
    geofenceId: {
      type: mongoose.Types.ObjectId,
      ref: "Geofence",
      required: true,
    },
    viewCustomers: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamp: true,
  }
);

const Manager = mongoose.model("Manager", managerSchema);
module.exports = Manager;