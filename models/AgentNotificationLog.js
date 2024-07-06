const mongoose = require("mongoose");
const AgentNotificationLogSchema = new mongoose.Schema({
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Agent",
    required: true,
  },
  notificationType: {
    type: String,
    enum: ["Announcement", "Order"],
    required: true,
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: true,
  },
  description: {
    type: String,
  },
});
