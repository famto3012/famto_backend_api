const mongoose = require("mongoose");

const referralCodeSchema = new mongoose.Schema({
  customerId: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    default: null,
  },
  email: {
    type: String,
    default: null,
  },
  referralCode: {
    type: String,
    unique: true,
    required: true,
  },
  numOfReferrals: {
    type: Number,
    default: 0,
  },
});

const ReferralCode = mongoose.model("ReferralCode", referralCodeSchema);
module.exports = ReferralCode;
