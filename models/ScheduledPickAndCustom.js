const mongoose = require("mongoose");
const DatabaseCounter = require("./DatabaseCounter");

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
    voiceInstructionInPickup: {
      type: String,
      default: null,
    },
    voiceInstructionInDelivery: {
      type: String,
      default: null,
    },
    voiceInstructiontoAgent: {
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
    _id: {
      type: String,
    },
    customerId: {
      type: String,
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

// Middleware to set the custom _id before saving
scheduledPickAndCustomSchema.pre("save", async function (next) {
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
      console.log(`Generated scheduled custom _id: ${customId}`);
      this._id = customId;
    }
    next();
  } catch (error) {
    next(error);
  }
});

const scheduledPickAndCustom = mongoose.model(
  "scheduledPickAndCustom",
  scheduledPickAndCustomSchema
);
module.exports = scheduledPickAndCustom;
