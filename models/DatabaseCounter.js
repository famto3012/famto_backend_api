const mongoose = require("mongoose");

const databaseCounterSchema = mongoose.Schema({
  type: {
    type: String,
    enum: ["Agent", "Customer", "Merchant", "Order", "ScheduledOrder"],
    required: true,
  },
  year: {
    type: Number,
    required: true,
  },
  month: {
    type: Number,
    required: true,
  },
  count: {
    type: Number,
    default: 0,
  },
});

const DatabaseCounter = mongoose.model(
  "DatabaseCounter",
  databaseCounterSchema
);

module.exports = DatabaseCounter;
