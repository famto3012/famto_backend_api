const mongoose = require("mongoose");

const pickupSchema = new mongoose.Schema({
  pickupStatus: {
    type: String,
    enum: ["Pending", "Accepted", "Started", "Completed", "Cancelled"],
    default: "Pending",
  },
  pickupLocation: {
    type: [Number],
  },
  pickupAddress: {
    fullName: String,
    phoneNumber: String,
    flat: String,
    area: String,
    landmark: String,
  },
  startTime: {
    type: Date,
    default: null,
  },
  completedTime: {
    type: Date,
    default: null,
  },
});

const deliverySchema = new mongoose.Schema({
  deliveryStatus: {
    type: String,
    enum: ["Pending", "Accepted", "Started", "Completed", "Cancelled"],
    default: "Pending",
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
  startTime: {
    type: Date,
    default: null,
  },
  completedTime: {
    type: Date,
    default: null,
  },
});

const taskSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      ref: "Order",
      required: true,
    },
    agentId: {
      type: String,
      ref: "Agent",
      default: null,
    },
    taskStatus: {
      type: String,
      enum: ["Assigned", "Unassigned", "Completed", "Cancelled"],
      default: "Unassigned",
    },
    deliveryMode: {
      type: String,
      enum: ["Home Delivery", "Take Away", "Pick and Drop", "Custom Order"],
      required: true,
    },
    // startTime: {
    //   type: Date,
    // },
    // endTime: {
    //   type: Date,
    // },
    pickupDetail: pickupSchema,
    deliveryDetail: deliverySchema,
  },
  {
    timestamps: true,
  }
);

const Task = mongoose.model("Task", taskSchema);
module.exports = Task;
