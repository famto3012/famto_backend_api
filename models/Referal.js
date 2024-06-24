const mongoose = require("mongoose");

const referalSchema = mongoose.Schema(
  {
    referalType: {
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
    referalCodeOnCustomerSignUp: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Referal = mongoose.model("Referal", referalSchema);
module.exports = Referal;
