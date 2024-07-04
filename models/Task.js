const mongoose = require("mongoose");

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
      enum: ["Assigned", "Unassigned"],
      default: "Unassigned",
    },
    deliveryStatus: {
      type: String,
      enum: ["Pending", "In-progress", "Completed"],
      default: "Pending",
    },
  },
  {
    timestamps: true,
  }
);

const Task = mongoose.model("Task", taskSchema);
module.exports = Task;
