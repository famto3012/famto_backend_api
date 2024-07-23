const mongoose = require("mongoose");

const customerPricingSchema = new mongoose.Schema({
  orderType: {
    type: String,
    enum: ["Universal Order", "Pick and Drop", "Custom Order"],
    required: true,
  },
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
  vehicleType: {
    type: String,
    enum: ["Scooter", "Bike"],
    default: null,
  },
});

const CustomerPricing = mongoose.model(
  "CustomerPricing",
  customerPricingSchema
);
module.exports = CustomerPricing;
