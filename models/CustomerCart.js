const mongoose = require("mongoose");

// Define the CartItem schema
const cartItemSchema = mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    variantTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  {
    _id: false,
  }
);

const cartDetailsSchema = mongoose.Schema(
  {
    pickupLocation: {
      type: [Number],
      required: true,
    },
    deliveryLocation: {
      type: [Number],
      required: true,
    },
    deliveryMode: {
      type: String,
      enum: ["Delivery", "Take-away"],
      required: true,
    },
    deliveryOption: {
      type: String,
      enum: ["On-demand", "Scheduled"],
      required: true,
    },
    deliveryAddress: {
      fullName: String,
      phoneNumber: String,
      flat: String,
      area: String,
      landmark: String || null,
    },
    instructionToMerchant: {
      type: String,
      default: null,
    },
    instructionToDeliveryAgent: {
      type: String,
      default: null,
    },
    addedTip: {
      type: Number,
      default: null,
    },
    distance: {
      type: Number,
      required: true,
    },
    deliveryChargePerday: {
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

// Define the Cart schema
const CustomerCartSchema = mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      required: true,
    },
    items: [cartItemSchema],
    cartDetails: cartDetailsSchema,
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const CustomerCart = mongoose.model("CustomerCart", CustomerCartSchema);
module.exports = CustomerCart;
