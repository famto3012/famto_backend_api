const mongoose = require("mongoose");

const tokenSchema = mongoose.Schema(
  {
    mapplsAuthToken: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Token = mongoose.model("Token", tokenSchema);
module.exports = Token;
