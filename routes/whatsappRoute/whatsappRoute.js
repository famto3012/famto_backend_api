const express = require("express");
const {
  verifyWebhook,
  handleWebhook,
  sendWhatsAppMessage,
  getWhatsAppMessages,
  getMessagesByWaId,
} = require("../../controllers/whatsapp/whatsappController");
const { upload } = require("../../utils/imageOperation");

const whatsappRoute = express.Router();

whatsappRoute.get("/webhook", verifyWebhook);
whatsappRoute.post("/webhook", handleWebhook);
whatsappRoute.post(
  "/send-message",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "document", maxCount: 1 },
    { name: "audio", maxCount: 1 },
  ]),
  sendWhatsAppMessage
);
whatsappRoute.get("/message", getWhatsAppMessages);
whatsappRoute.get("/message/:waId", getMessagesByWaId);

module.exports = whatsappRoute;
