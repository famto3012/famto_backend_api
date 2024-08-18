const mongoose = require("mongoose");
const DatabaseCounter = require("./DatabaseCounter");

const orderItemSchema = mongoose.Schema(
  {
    price: {
      type: Number,
      default: null,
    },
    variantTypeName: {
      type: String,
      default: null,
    },
    itemName: {
      type: String,
      default: null,
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
      default: null,
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
    itemId: {
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
    voiceInstructionToMerchant: {
      type: String,
      default: null,
    },
    voiceInstructionToDeliveryAgent: {
      type: String,
      default: null,
    },
    voiceInstructionInPickup: {
      type: String,
      default: null,
    },
    voiceInstructionInDelivery: {
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
      default: 0 || null,
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
        default: null,
      },
      rating: {
        type: Number,
        min: 1,
        max: 5,
      },
    },
    ratingByDeliveryAgent: {
      review: {
        type: String,
        default: null,
      },
      rating: {
        type: Number,
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

const shopUpdatesSchema = mongoose.Schema({
  location: {
    type: [Number],
    required: true,
  },
  status: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: null,
  },
});

const detailAddedByAgentSchema = mongoose.Schema({
  agentEarning: {
    type: Number,
    default: null,
  },
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
  shopUpdates: [shopUpdatesSchema],
});

const stepperSchema = mongoose.Schema({
  by: { type: String, default: null },
  userId: { type: String, default: null },
  date: { type: Date, default: null },
});

const orderDetailStepperSchema = mongoose.Schema({
  created: stepperSchema,
  assigned: stepperSchema,
  accepted: stepperSchema,
  started: stepperSchema,
  reachedPickupLocation: stepperSchema,
  noteAdded: stepperSchema,
  signatureAdded: stepperSchema,
  imageAdded: stepperSchema,
  completed: stepperSchema,
});

const orderSchema = mongoose.Schema(
  {
    _id: {
      type: String,
    },
    customerId: {
      type: String,
      ref: "Customer",
      required: true,
    },
    merchantId: {
      type: String,
      ref: "Merchant",
    },
    agentId: {
      type: String,
      ref: "Agent",
      defalt: null,
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
    cancellationReason: {
      type: String,
      default: null,
    },
    cancellationDescription: {
      type: String,
      default: null,
    },
    orderRating: orderRatingSchema,
    commissionDetail: commissionDetailSchema,
    detailAddedByAgent: detailAddedByAgentSchema,
    orderDetailStepper: orderDetailStepperSchema,
  },
  {
    timestamps: true,
  }
);

// Middleware to set the custom _id before saving
orderSchema.pre("save", async function (next) {
  try {
    if (this.isNew) {
      const now = new Date();
      const year = now.getFullYear().toString().slice(-2); // Last two digits of the year
      const month = `0${now.getMonth() + 1}`.slice(-2); // Zero-padded month

      let counter = await DatabaseCounter.findOneAndUpdate(
        { type: "Order", year: parseInt(year, 10), month: parseInt(month, 10) },
        { $inc: { count: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      if (!counter) {
        throw new Error("Counter document could not be created or updated.");
      }

      const customId = `O${year}${month}${counter.count}`;
      this._id = customId;
    }
    next();
  } catch (error) {
    next(error);
  }
});

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
