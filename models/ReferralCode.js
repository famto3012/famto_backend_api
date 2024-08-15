const mongoose = require("mongoose");

const referralCodeSchema = new mongoose.Schema({
  customerId: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
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
