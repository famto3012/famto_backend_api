const mongoose = require("mongoose");

const customerPricingSchema = new mongoose.Schema({
  deliveryMode: {
    type: String,
    enum: ["Home Delivery", "Pick and Drop", "Custom Order"],
    required: true,
  },
  businessCategoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BusinessCategory",
    default: null,
  },
  ruleName: {
    type: String,
    required: true,
  },
  baseFare: {
    type: Number,
    default: null,
  },
  baseDistance: {
    type: Number,
    default: null,
  },
  fareAfterBaseDistance: {
    type: Number,
    default: null,
  },
  baseWeightUpto: {
    type: Number,
    default: null,
  },
  fareAfterBaseWeight: {
    type: Number,
    default: null,
  },
  purchaseFarePerHour: {
    type: Number,
    default: null,
  },
  waitingFare: {
    type: Number,
    default: null,
  },
  waitingTime: {
    type: Number,
    default: null,
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
