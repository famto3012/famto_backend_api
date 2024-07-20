const mongoose = require("mongoose");

const ratingsByCustomerSchema = mongoose.Schema({
  customerId: {
    type: mongoose.Types.ObjectId,
    ref: "Customer",
    required: true,
  },
  review: {
    type: String,
    required: true,
  },
  rating: {
    type: Number,
    required: true,
  },
});

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
      required: true,
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
    type: mongoose.Schema.Types.ObjectId,
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
    pendingOrder: {
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
      required: true,
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
      required: true,
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
      enum: ["Approved", "Pending", "Rejected"],
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

// Virtual field for calculating the average rating
agentSchema.virtual("averageRating").get(function () {
  if (this.ratingsByCustomers?.length === 0) {
    return 0;
  }
  const total = this.ratingsByCustomers?.reduce(
    (acc, rating) => acc + rating.rating,
    0
  );
  return total / this.ratingsByCustomers?.length;
});

const Agent = mongoose.model("Agent", agentSchema);
module.exports = Agent;
