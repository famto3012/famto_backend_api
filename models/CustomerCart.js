const mongoose = require("mongoose");

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

const cartDetailSchema = mongoose.Schema(
  {
    pickupLocation: {
      type: [Number],
      required: true,
    },
    pickupAddress: {
      fullName: String,
      area: String,
      phoneNumber: String,
    },
    deliveryLocation: {
      type: [Number],
      required: true,
    },
    deliveryMode: {
      type: String,
      enum: ["Home Delivery", "Take Away"],
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
      landmark: String,
    },
    instructionToMerchant: {
      type: String,
      default: null,
    },
    instructionToDeliveryAgent: {
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
      type: Date, //String,
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
    surgePrice: {
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
    cartDetail: cartDetailSchema,
    billDetail: billSchema,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const CustomerCart = mongoose.model("CustomerCart", CustomerCartSchema);
module.exports = CustomerCart;
