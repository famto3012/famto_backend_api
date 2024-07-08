const mongoose = require("mongoose");

const orderItemSchema = mongoose.Schema(
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

const orderDetailSchema = mongoose.Schema(
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
      landmark: { type: String, default: null },
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
    deliveryCharge: {
      type: Number,
      required: true,
    },
    taxAmount: {
      type: Number,
      required: true,
    },
    discountedAmount: {
      type: Number,
      default: null,
    },
    grandTotal: {
      type: Number,
      required: true,
    },
    itemTotal: {
      type: Number,
      default: 0,
    },
    addedTip: {
      type: Number,
      default: 0,
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

const orderSchema = mongoose.Schema(
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
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
    },
    items: [orderItemSchema],
    orderDetail: orderDetailSchema,
    billDetail: billSchema,
    status: {
      type: String,
      required: true,
      enum: ["Pending", "On-going", "Completed", "Cancelled"],
      default: "Pending",
    },
    paymentMode: {
      type: String,
      required: true,
      enum: ["Famto-cash", "Online-payment", "Cash-on-delivery"],
    },
    paymentId: {
      type: String,
      default: null,
    },
    refundId: {
      type: String,
      default: null,
    },
    paymentStatus: {
      type: String,
      required: true,
      enum: ["Pending", "Completed", "Failed"],
      default: "Pending",
    },
  },
  {
    timestamps: true,
  }
);

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
