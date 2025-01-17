const express = require("express");
const {
  verifyWebhook,
  handleWebhook,
} = require("../../controllers/whatsapp/whatsappController");

const whatsappRoute = express.Router();

whatsappRoute.get("/webhook", verifyWebhook);
whatsappRoute.post("/webhook", handleWebhook);

module.exports = whatsappRoute;
