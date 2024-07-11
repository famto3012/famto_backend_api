const mongoose = require("mongoose");

const cartItemSchema = mongoose.Schema(
  {
    itemType: {
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
      required: true,
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
    distance: {
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
    taxAmount: {
      type: Number,
      required: true,
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
      required: true,
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
  item: [cartItemSchema],
});

const PickAndCustomCart = mongoose.model(
  "PickAndCustomCart",
  pickAndCustomCartSchema
);
module.exports = PickAndCustomCart;
