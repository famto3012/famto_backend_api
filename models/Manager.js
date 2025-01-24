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
      type: mongoose.Schema.Types.ObjectId,
      ref: "ManagerRoles",
      required: true,
    },
    geofenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Geofence",
      required: true,
    },
    resetPasswordToken: {
      type: String,
    },
    resetPasswordExpiry: {
      type: Date,
    },
    refreshToken: {
      type: String,
      default: null,
    },
  },
  {
    timestamp: true,
  }
);

const Manager = mongoose.model("Manager", managerSchema);
module.exports = Manager;
