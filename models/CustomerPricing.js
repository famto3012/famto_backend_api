const mongoose = require("mongoose");

const customerPricingSchema = new mongoose.Schema({
  ruleName: {
    type: String,
    required: true,
  },
  baseFare: {
    type: Number,
    required: true,
  },
  baseDistance: {
    type: Number,
    required: true,
  },
  fareAfterBaseDistance: {
    type: Number,
    required: true,
  },
  baseWeightUpto: {
    type: Number,
    required: true,
  },
  fareAfterBaseWeight: {
    type: Number,
    required: true,
  },
  purchaseFarePerHour: {
    type: Number,
    required: true,
  },
  waitingFare: {
    type: Number,
    required: true,
  },
  waitingTime: {
    type: Number,
    required: true,
  },
  addedTip: {
    type: Number,
    required: true,
  },
  geofenceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Geofence",
    required: true,
  },
  status: {
    type: Boolean,
    default: true,
    required: true,
  },
});

const CustomerPricing = mongoose.model(
  "CustomerPricing",
  customerPricingSchema
);
module.exports = CustomerPricing;
