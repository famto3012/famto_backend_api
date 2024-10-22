const mongoose = require("mongoose");
const DatabaseCounter = require("./DatabaseCounter");

const scheduledOrderItemSchema = mongoose.Schema(
  {
    itemName: {
      type: String,
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
    variantTypeName: {
      type: String,
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

const scheduledOrderDetailSchema = mongoose.Schema(
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
    voiceInstructionToMerchant: {
      type: String,
      default: null,
    },
    voiceInstructionToDeliveryAgent: {
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
      default: 0,
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
      required: true,
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

const purchasedItemsSchema = mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
});

const scheduledOrderSchema = mongoose.Schema(
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
      required: true,
    },
    items: [scheduledOrderItemSchema],
    orderDetail: scheduledOrderDetailSchema,
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
    isViewed: {
      type: Boolean,
      default: false,
    },
    purchasedItems: [purchasedItemsSchema],
  },
  {
    timestamps: true,
  }
);

// Middleware to set the custom _id before saving
scheduledOrderSchema.pre("save", async function (next) {
  try {
    if (this.isNew) {
      const now = new Date();
      const year = now.getFullYear().toString().slice(-2); // Last two digits of the year
      const month = `0${now.getMonth() + 1}`.slice(-2); // Zero-padded month

      let counter = await DatabaseCounter.findOneAndUpdate(
        {
          type: "ScheduledOrder",
          year: parseInt(year, 10),
          month: parseInt(month, 10),
        },
        { $inc: { count: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      if (!counter) {
        throw new Error("Counter document could not be created or updated.");
      }

      const customId = `SO${year}${month}${counter.count}`;
      this._id = customId;
    }
    next();
  } catch (error) {
    next(error);
  }
});

const ScheduledOrder = mongoose.model("ScheduledOrder", scheduledOrderSchema);
module.exports = ScheduledOrder;
