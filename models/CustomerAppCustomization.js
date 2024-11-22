const mongoose = require("mongoose");

const customOrderCustomizationSchema = new mongoose.Schema(
  {
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    taxId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tax",
      default: null,
    },
  },
  {
    _id: false,
  }
);

const pickAndDropOrderCustomizationSchema = new mongoose.Schema(
  {
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    taxId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tax",
      default: null,
    },
  },
  {
    _id: false,
  }
);

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
    customOrderCustomization: customOrderCustomizationSchema,
    pickAndDropOrderCustomization: pickAndDropOrderCustomizationSchema,
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
