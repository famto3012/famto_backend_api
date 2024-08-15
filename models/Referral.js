const mongoose = require("mongoose");

const referralSchema = mongoose.Schema(
  {
    referralType: {
      type: String,
      enum: ["Flat-discount", "Percentage-discount"],
      required: true,
    },
    referrerDiscount: {
      type: Number,
      required: true,
    },
    referrerMaxDiscountValue: {
      type: Number,
    },
    referrerAppHeadingAndDescription: {
      type: String,
      required: true,
    },
    refereeDiscount: {
      type: Number,
      required: true,
    },
    refereeMaxDiscountValue: {
      type: Number,
    },
    minOrderAmount: {
      type: Number,
      required: true,
    },
    refereeDescription: {
      type: String,
      required: true,
    },
    status: {
      type: Boolean,
      default: true,
    },
    referralCodeOnCustomerSignUp: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Referral = mongoose.model("Referral", referralSchema);
module.exports = Referral;
