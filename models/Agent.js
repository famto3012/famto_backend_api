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
      type: mongoose.Types.ObjectId,
      ref: "Manager",
      required: true,
    },
    salaryStructureId: {
      type: mongoose.Types.ObjectId,
      ref: "AgentPricing",
      required: true,
    },
    tag: {
      type: String,
      enum: ["Fish & Meat", "Normal"],
      required: true,
    },
  },
  { _id: false }
);

const personalDetailSchema = mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  homeAddress: {
    type: String,
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
      type: mongoose.Schema.ObjectId,
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
    vehicleDetail: [vehicleSchema],
    governmentCertificateDetail: governmentCertificateDetailSchema,
    bankDetail: bankDetailSchema,
    workStructure: workStructureSchema,
    personalDetail: personalDetailSchema,
    ratingsByCustomers: [ratingsByCustomerSchema],
  },
  {
    timestamp: true,
  }
);

const Agent = mongoose.model("Agent", agentSchema);
module.exports = Agent;
