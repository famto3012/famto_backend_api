const mongoose = require("mongoose");

const fcmTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      unique: true,
    },
    token: {
      type: [String], // Define `tokens` as an array of strings
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const FcmToken = mongoose.model("FcmToken", fcmTokenSchema);
module.exports = FcmToken;
