const mongoose = require("mongoose");

const pickupSchema = new mongoose.Schema({
  pickupStatus: {
    type: String,
    enum: ["Pending", "Accepted", "Started", "Completed"],
    default: "Pending",
  },
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
    landmark: String,
  },
});

const deliverySchema = new mongoose.Schema({
  deliveryStatus: {
    type: String,
    enum: ["Pending", "Accepted", "Started", "Completed"],
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
    phoneNumber: String,
    landmark: String,
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
      enum: ["Assigned", "Unassigned", "Completed"],
      default: "Unassigned",
    },
    deliveryMode: {
      type: String,
      enum: ["Home Delivery", "Take Away", "Pick and Drop", "Custom Order"],
      required: true,
    },
    startTime: {
      type: Date,
    },
    endTime: {
      type: Date,
    },
    pickupDetail: pickupSchema,
    deliveryDetail: deliverySchema,
  },
  {
    timestamps: true,
  }
);

const Task = mongoose.model("Task", taskSchema);
module.exports = Task;
