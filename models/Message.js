const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
    },
    sender: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    text: String,
    seen: {
      type: Boolean,
      default: false,
    },
    img: {
      type: String,
      default: "",
    },
    deletionDate: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Pre-save hook to set deletionDate 7 days after createdAt
messageSchema.pre("save", function (next) {
  if (!this.deletionDate) {
    this.deletionDate = new Date(this.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days in milliseconds
  }
  next();
});

const Message = mongoose.model("Message", messageSchema);

module.exports = Message;
