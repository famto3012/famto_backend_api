const mongoose = require("mongoose");

const scheduledOrderItemSchema = mongoose.Schema(
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

const scheduledOrderDetailSchema = mongoose.Schema(
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
    deliveryAddressType: {
      type: String,
      required: true,
    },
    addedTip: {
      type: Number,
      default: null,
    },
    distance: {
      type: Number,
    },
    taxAmount: {
      type: Number,
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
  },
  {
    _id: false,
  }
);

const scheduledOrderSchema = mongoose.Schema(
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
    status: {
      type: String,
      required: true,
      enum: ["Pending", "Completed"],
      default: "Pending",
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    paymentMode: {
      type: String,
      required: true,
      enum: ["Famto-cash", "Online-payment"],
    },
    paymentStatus: {
      type: String,
      required: true,
      enum: ["Pending", "Completed", "Failed"],
      default: "Pending",
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    time: {
      type: String,
      required: true,
    },
    paymentId: {
      type: String,
    },
    itemTotal: {
      type: Number,
      default: 0,
    },
    items: [scheduledOrderItemSchema],
    orderDetail: scheduledOrderDetailSchema,
  },
  {
    timestamps: true,
  }
);

const ScheduledOrder = mongoose.model("ScheduledOrder", scheduledOrderSchema);
module.exports = ScheduledOrder;
