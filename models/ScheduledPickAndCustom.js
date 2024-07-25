const mongoose = require("mongoose");

const scheduledPickAndCustomItemSchema = mongoose.Schema(
  {
    itemType: {
      type: String,
    },
    length: {
      type: Number,
    },
    width: {
      type: Number,
    },
    height: {
      type: Number,
    },
    unit: {
      type: String,
    },
    weight: {
      type: Number,
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
  { _id: false }
);

const scheduledPickAndCustomDetailSchema = mongoose.Schema(
  {
    pickupLocation: {
      type: [Number],
      default: null,
    },
    pickupAddress: {
      fullName: String,
      phoneNumber: String,
      flat: String,
      area: String,
      landmark: String,
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
      landmark: String,
    },
    deliveryMode: {
      type: String,
      enum: ["Pick and Drop", "Custom Order"],
      required: true,
    },
    deliveryOption: {
      type: String,
      enum: ["On-demand", "Scheduled"],
      required: true,
    },
    instructionInDelivery: {
      type: String,
      default: null,
    },
    instructionInPickup: {
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
  { _id: false }
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
      default: 0,
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
      default: 0,
    },
  },
  { _id: false }
);

const scheduledPickAndCustomSchema = mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    items: [scheduledPickAndCustomItemSchema],
    orderDetail: scheduledPickAndCustomDetailSchema,
    billDetail: billSchema,
    totalAmount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["Pending", "Completed"],
      default: "Pending",
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
      type: Date,
      required: true,
    },
    paymentId: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const scheduledPickAndCustom = mongoose.model(
  "scheduledPickAndCustom",
  scheduledPickAndCustomSchema
);
module.exports = scheduledPickAndCustom;
