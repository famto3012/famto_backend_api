const mongoose = require("mongoose");

const accountLogsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.ObjectId,
      required: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const AccountLogs = mongoose.model("AccountLogs", accountLogsSchema);
module.exports = AccountLogs;
