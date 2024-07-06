const { Server } = require("socket.io");
const http = require("http");
const express = require("express");
const Task = require("../models/Task");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Replace with the correct URL of your React app
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const getRecipientSocketId = (recipientId) => {
  return userSocketMap[recipientId];
};

const userSocketMap = {};
io.on("connection", (socket) => {
  console.log("user connected", socket.id);
  const userId = socket.handshake.query.userId;
  if (userId != "undefined") userSocketMap[userId] = socket.id;
  io.emit("getOnlineUsers", Object.keys(userSocketMap));
  console.log(userSocketMap);

  socket.on("Accepted", async (data) => {
    const task = await Task.find({ orderId: data.orderId });
    await Task.findByIdAndUpdate(task[0]._id, {
      agentId: data.agentId,
      taskStatus: "Assigned",
    });
  });

  socket.on("disconnect", () => {
    console.log("user disconnected", socket.id);
    delete userSocketMap[userId];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});



module.exports = { io, server, app, getRecipientSocketId };
