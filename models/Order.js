const mongoose = require("mongoose");

const orderItemSchema = mongoose.Schema(
  {
    price: {
      type: Number,
    },
    variantTypeName: {
      type: String,
    },
    itemName: {
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
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
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
    pickupAddress: {
      fullName: String,
      phoneNumber: String,
      flat: String,
      area: String,
      phoneNumber: String,
      landmark: { type: String, default: null },
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
    deliveryMode: {
      type: String,
      enum: ["Home Delivery", "Take Away", "Pick and Drop", "Custom Order"],
      required: true,
    },
    deliveryOption: {
      type: String,
      enum: ["On-demand", "Scheduled"],
      required: true,
    },
    deliveryTime: {
      type: Date,
      default: null,
    },
    agentAcceptedAt: {
      type: Date,
      default: null,
    },
    timeTaken: {
      type: Number, // Storing in milliseconds
      default: null,
    },
    delayedBy: {
      type: Number, // Storing in milliseconds
      default: null,
    },
    instructionToMerchant: {
      type: String,
      default: null,
    },
    instructionToDeliveryAgent: {
      type: String,
      default: null,
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
    surgePrice: {
      type: Number,
      default: null,
    },
  },
  {
    _id: false,
  }
);

const orderRatingSchema = mongoose.Schema(
  {
    ratingToDeliveryAgent: {
      review: {
        type: String,
        required: true,
      },
      rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
      },
    },
    ratingByDeliveryAgent: {
      review: {
        type: String,
        required: true,
      },
      rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
      },
    },
  },
  {
    _id: false,
  }
);

const commissionDetailSchema = mongoose.Schema(
  {
    merchantEarnings: {
      type: Number,
      required: true,
    },
    famtoEarnings: {
      type: Number,
      required: true,
    },
  },
  {
    _id: false,
  }
);

const detailAddedByAgentSchema = mongoose.Schema({
  notes: {
    type: String,
    default: null,
  },
  signatureImageURL: {
    type: String,
    default: null,
  },
  imageURL: {
    type: String,
    default: null,
  },
});

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
    orderRating: orderRatingSchema,
    commissionDetail: commissionDetailSchema,
    detailAddedByAgent: detailAddedByAgentSchema,
  },
  {
    timestamps: true,
  }
);

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
