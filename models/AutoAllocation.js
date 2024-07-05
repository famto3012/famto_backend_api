const mongoose = require("mongoose");

const AutoAllocationSchema = new mongoose.Schema(
  {
    expireTime: {
      type: Number,
      default: 0,
    },
    autoAllocationType: {
      type: String,
      enum: ["All", "Nearest"],
      required: true,
    },
    maxRadius: {
      type: Number,
      default: 0,
    },
    priorityType: {
      type: String,
      enum: ["Default", "Monthly-salaried"],
    },
    isActive: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const AutoAllocation = mongoose.model("AutoAllocation", AutoAllocationSchema);
module.exports = AutoAllocation;
