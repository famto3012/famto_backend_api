const mongoose = require("mongoose");

const whatsappSchema = new mongoose.Schema(
  {
    displayPhoneNumber: String,
    phoneNumberId: String,
    waId: String,
    name: String,
    messageBody: String,
    messageType: String,

    // Location Data (if available)
    location: {
      latitude: Number,
      longitude: Number,
    },

    // Image Data (if available)
    image: {
      id: String,
      mimeType: String,
      sha256: String,
      caption: String,
      link: String,
    },

    // Audio Data (if available)
    audio: {
      id: String,
      mimeType: String,
      sha256: String,
      voice: Boolean,
    },

    // Contact Data (if available)
    contact: {
      firstName: String,
      middleName: String,
      lastName: String,
      fullName: String,
      company: String,
      phone: String,
      waId: String,
      phoneType: String,
    },

    // Document Data (if available)
    document: {
      fileName: String,
      mimeType: String,
      sha256: String,
      documentId: String,
      link: String,
    },

    // Message Metadata
    timestamp: Number,
    messageId: String,

    // Delivery Status (sent, delivered, read, etc.)
    deliveryStatus: {
      type: String,
      enum: ["sent", "delivered", "read", "failed"],
      default: "sent",
    },
    received: {
      type: Boolean,
      default: false,
    },
    send: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const WhatsApp = mongoose.model("WhatsApp", whatsappSchema);

module.exports = WhatsApp;
