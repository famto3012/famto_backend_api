const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      default: "Admin",
    },
    isApproved: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Approved",
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    resetPasswordToken: {
      type: String,
    },
    resetPasswordExpiry: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

const Admin = mongoose.model("Admin", adminSchema);
module.exports = Admin;
