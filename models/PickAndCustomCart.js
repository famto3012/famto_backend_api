const mongoose = require("mongoose");

const cartItemSchema = mongoose.Schema(
  {
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    itemName: {
      type: String,
      required: true,
    },
    length: {
      type: Number,
      default: null,
    },
    width: {
      type: Number,
      default: null,
    },
    height: {
      type: Number,
      default: null,
    },
    unit: {
      type: String,
      required: true,
    },
    weight: {
      type: Number,
      default: null,
    },
    numOfUnits: {
      type: Number,
      default: null,
    },
    quantity: {
      type: Number,
      default: null,
    },
    itemImageURL: {
      type: String,
      default: null,
    },
  },
  {
    _id: false,
  }
);

const cartDetailSchema = mongoose.Schema(
  {
    pickupLocation: {
      type: [Number],
      required: true,
    },
    pickupAddress: {
      fullName: String,
      phoneNumber: String,
      flat: String,
      area: String,
      landmark: { type: String, default: null },
    },
    instructionInPickup: {
      type: String,
      default: null,
    },
    deliveryLocation: {
      type: [Number],
      required: true,
    },
    deliveryAddress: {
      fullName: String,
      phoneNumber: String,
      flat: String,
      area: String,
      landmark: { type: String, default: null },
    },
    instructionInDelivery: {
      type: String,
      default: null,
    },
    deliveryMode: {
      type: String,
      default: "Pick and Drop",
    },
    deliveryOption: {
      type: String,
      enum: ["On-demand", "Scheduled"],
      required: true,
    },
    distance: {
      type: Number,
      required: true,
    },
    duration: {
      type: Number,
      required: true,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    time: {
      type: String,
      default: null,
    },
    numOfDays: {
      type: Number,
      default: null,
    },
  },
  {
    _id: false,
  }
);

const billSchema = mongoose.Schema(
  {
    deliveryChargePerDay: {
      type: Number,
      default: null,
    },
    originalDeliveryCharge: {
      type: Number,
      required: true,
    },
    discountedDeliveryCharge: {
      type: Number,
      default: null,
    },
    discountedAmount: {
      type: Number,
      default: null,
    },
    originalGrandTotal: {
      type: Number,
      default: null,
    },
    discountedGrandTotal: {
      type: Number,
      default: null,
    },
    itemTotal: {
      type: Number,
      default: 0,
    },
    addedTip: {
      type: Number,
      default: null,
    },
    subTotal: {
      type: Number,
      default: null,
    },
    vehicleType: {
      type: String,
      default: null,
    },
  },
  {
    _id: false,
  }
);

const pickAndCustomCartSchema = mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  cartDetail: cartDetailSchema,
  billDetail: billSchema,
  items: [cartItemSchema],
});

const PickAndCustomCart = mongoose.model(
  "PickAndCustomCart",
  pickAndCustomCartSchema
);
module.exports = PickAndCustomCart;
