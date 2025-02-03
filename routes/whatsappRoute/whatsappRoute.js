const express = require("express");
const {
  verifyWebhook,
  handleWebhook,
  sendWhatsAppMessage,
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
  ]),
  sendWhatsAppMessage
);

module.exports = whatsappRoute;
