const express = require("express");
//const { upload } = require("../../utils/imageOperation");
const {
  getMessages,
  sendMessage,
  getConversations,
} = require("../../controllers/customer/messageController");
const isAuthenticated = require("../../middlewares/isAuthenticated");
const { upload } = require("../../utils/imageOperation");
const messageRoute = express.Router();

messageRoute.get("/conversation", isAuthenticated, getConversations);
messageRoute.post(
  "/",
  upload.single("messageImage"),
  isAuthenticated,
  sendMessage
);
messageRoute.get("/:otherUserId", isAuthenticated, getMessages);

module.exports = messageRoute;
