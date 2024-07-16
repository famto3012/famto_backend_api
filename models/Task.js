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
    landmark: { type: String, default: null },
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
    landmark: { type: String, default: null },
  },
});

const taskSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      default: null,
    },
    taskStatus: {
      type: String,
      enum: ["Assigned", "Unassigned", "Completed"],
      default: "Unassigned",
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
