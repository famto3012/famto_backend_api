const mongoose = require("mongoose");
const { formatToHours } = require("../utils/agentAppHelpers");
const DatabaseCounter = require("./DatabaseCounter");

const ratingsByCustomerSchema = mongoose.Schema(
  {
    customerId: {
      type: String,
      ref: "Customer",
      required: true,
    },
    review: {
      type: String,
      default: null,
    },
    rating: {
      type: Number,
      default: 0,
    },
  },
  {
    _id: false,
  }
);

const vehicleSchema = mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    vehicleStatus: { type: Boolean, default: false },
    model: { type: String, required: true },
    type: {
      type: String,
      enum: ["Scooter", "Bike"], //INFO: Add more types if needed
      required: true,
    },
    licensePlate: { type: String, required: true },
    rcFrontImageURL: { type: String, required: true },
    rcBackImageURL: { type: String, required: true },
  },
  { _id: false }
);

const governmentCertificateDetailSchema = mongoose.Schema(
  {
    aadharNumber: {
      type: String,
      required: true,
    },
    aadharFrontImageURL: {
      type: String,
      required: true,
    },
    aadharBackImageURL: {
      type: String,
      required: true,
    },
    drivingLicenseNumber: {
      type: String,
      required: true,
    },
    drivingLicenseFrontImageURL: {
      type: String,
      required: true,
    },
    drivingLicenseBackImageURL: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const bankDetailSchema = mongoose.Schema(
  {
    accountHolderName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    IFSCCode: { type: String, required: true },
    UPIId: { type: String, required: true },
  },
  { _id: false }
);

const workStructureSchema = mongoose.Schema(
  {
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Manager",
      default: null,
    },
    salaryStructureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AgentPricing",
      required: true,
    },
    tag: {
      type: String,
      enum: ["Fish & Meat", "Normal"],
      required: true,
    },
    cashInHand: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const orderDetailSchema = mongoose.Schema({
  orderId: {
    type: String,
    ref: "Order",
  },
  deliveryMode: {
    type: String,
    required: true,
  },
  customerName: {
    type: String,
    required: true,
  },
  completedOn: {
    type: Date,
    required: true,
  },
  grandTotal: {
    type: Number,
    required: true,
  },
});

const agentAppDetailSchema = mongoose.Schema(
  {
    totalEarning: {
      type: Number,
      default: 0,
    },
    orders: {
      type: Number,
      default: 0,
    },
    pendingOrders: {
      type: Number,
      default: 0,
    },
    totalDistance: {
      type: Number,
      default: 0,
    },
    cancelledOrders: {
      type: Number,
      default: 0,
    },
    loginDuration: {
      type: Number,
      default: 0, // Store login duration in milliseconds
    },
    orderDetail: [orderDetailSchema],
    paymentSettled: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: false,
  }
);

const agentTransactionSchema = mongoose.Schema({
  type: {
    type: String,
    enum: ["Credit", "Debit"],
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  madeOn: {
    type: Date,
    required: true,
  },
});

const agentSchema = mongoose.Schema(
  {
    _id: {
      type: String,
    },
    fullName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    location: {
      type: [Number],
      // required: true,
    },
    geofenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Geofence",
    },
    role: {
      type: String,
      default: "Agent",
    },
    agentImageURL: {
      type: String,
      // required: true,
    },
    status: {
      type: String,
      enum: ["Inactive", "Free", "Busy"],
      default: "Inactive",
    },
    taskCompleted: {
      type: Number,
      default: 0,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    reasonForBlockingOrDeleting: {
      type: String,
      default: null,
    },
    blockedDate: {
      type: Date,
      default: null,
    },
    isApproved: {
      type: String,
      enum: ["Approved", "Pending"],
      default: "Pending",
    },
    loginStartTime: {
      type: Date,
      default: null,
    },
    loginEndTime: {
      type: Date,
      default: null,
    },
    vehicleDetail: [vehicleSchema],
    governmentCertificateDetail: governmentCertificateDetailSchema,
    bankDetail: bankDetailSchema,
    workStructure: workStructureSchema,
    ratingsByCustomers: [ratingsByCustomerSchema],
    appDetail: agentAppDetailSchema,
    appDetailHistory: [
      {
        _id: false,
        detailId: {
          type: mongoose.Schema.Types.ObjectId,
          default: () => new mongoose.Types.ObjectId(),
          required: true,
        },
        date: {
          type: Date,
          required: true,
        },
        details: agentAppDetailSchema,
      },
    ],
    agentTransaction: [agentTransactionSchema],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Middleware to set the custom _id before saving
agentSchema.pre("save", async function (next) {
  try {
    if (this.isNew) {
      const now = new Date();
      const year = now.getFullYear().toString().slice(-2); // Last two digits of the year
      const month = `0${now.getMonth() + 1}`.slice(-2); // Zero-padded month

      let counter = await DatabaseCounter.findOneAndUpdate(
        { type: "Agent", year: parseInt(year, 10), month: parseInt(month, 10) },
        { $inc: { count: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      if (!counter) {
        throw new Error("Counter document could not be created or updated.");
      }

      const customId = `A${year}${month}${counter.count}`;
      this._id = customId;
    }
    next();
  } catch (error) {
    next(error);
  }
});

workStructureSchema.pre("save", function (next) {
  if (this.managerId === "null") {
    this.managerId = null;
  }
  next();
});

// Virtual field for calculating the average rating
agentSchema.virtual("averageRating").get(function () {
  if (!this.ratingsByCustomers || this.ratingsByCustomers.length === 0) {
    return 0;
  }

  const total = this.ratingsByCustomers.reduce(
    (acc, rating) => acc + rating.rating,
    0
  );
  return total / this.ratingsByCustomers.length;
});

agentSchema.virtual("loggedInHours").get(function () {
  if (this.isApproved === "Pending") {
    return "0:00 hr";
  }

  const startTime = this?.loginStartTime;

  const difference = new Date() - new Date(startTime);

  return formatToHours(difference);
});

const Agent = mongoose.model("Agent", agentSchema);
module.exports = Agent;
