const mongoose = require("mongoose");

const customerAppCustomizationSchema = new mongoose.Schema(
  {
    splashScreenUrl: {
      type: String,
      required: true,
    },
    email: {
      type: Boolean,
      default: true,
    },
    phoneNumber: {
      type: Boolean,
      default: true,
    },
    emailVerification: {
      type: Boolean,
      default: true,
    },
    otpVerification: {
      type: Boolean,
      default: true,
    },
    loginViaOtp: {
      type: Boolean,
      default: true,
    },
    loginViaGoogle: {
      type: Boolean,
      default: true,
    },
    loginViaApple: {
      type: Boolean,
      default: true,
    },
    loginViaFacebook: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const CustomerAppCustomization = mongoose.model(
  "CustomerAppCustomization",
  customerAppCustomizationSchema
);
module.exports = CustomerAppCustomization;
