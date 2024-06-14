const mongoose = require("mongoose");

const vehicleSchema = mongoose.Schema(
  {
    vehicleStatus: { type: Boolean, default: false },
    model: { type: String, required: true },
    type: {
      type: String,
      enum: ["Two-wheeler", "Three-wheeler", "Four-wheeler"],
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
    salaryStructure: { type: String, required: true },

    tag: { type: String, enum: ["tag1", "tag2"], required: true },
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
    manager: {
      type: String,
      required: true,
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
      type: Boolean,
      default: false,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    vehicleDetail: [vehicleSchema],
    governmentCertificateDetail: governmentCertificateDetailSchema,
    bankDetail: bankDetailSchema,
    workstructure: workStructureSchema,
    personalDetail: personalDetailSchema,
  },
  {
    timestamp: true,
  }
);

const Agent = mongoose.model("Agent", agentSchema);
module.exports = Agent;
