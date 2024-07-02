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
      ref: "VariantType",
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
      required: true,
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
    },
    originalDeliveryCharge: {
      type: Number,
    },
    discountedDeliveryCharge: {
      type: Number,
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual field to calculate the total price
CustomerCartSchema.virtual("itemTotal").get(function () {
  return this.items.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );
});

const CustomerCart = mongoose.model("CustomerCart", CustomerCartSchema);
module.exports = CustomerCart;
