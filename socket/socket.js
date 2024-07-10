const { Server } = require("socket.io");
const http = require("http");
const express = require("express");
const Task = require("../models/Task");
const Agent = require("../models/Agent");
const Customer = require("../models/Customer");
const Merchant = require("../models/Merchant");
const Order = require("../models/Order");
const turf = require("@turf/turf");

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
//Connection socket
io.on("connection", (socket) => {
  console.log("user connected", socket.id);
  const userId = socket.handshake.query.userId;
  if (userId != "undefined") userSocketMap[userId] = socket.id;
  //Get online user socket
  io.emit("getOnlineUsers", Object.keys(userSocketMap));
  console.log(userSocketMap);
  //Order accepted by agent socket
  socket.on("Accepted", async (data) => {
    const task = await Task.find({ orderId: data.orderId });
    await Order.findByIdAndUpdate(data.orderId, {
      agentId: data.agentId,
    });
    await Agent.findByIdAndUpdate(data.agentId, {
      status: "Busy",
    });
    if (task.taskStatus === "Assigned") {
      appError("Task already assigned");
    } else {
      await Task.findByIdAndUpdate(task[0]._id, {
        agentId: data.agentId,
        taskStatus: "Assigned",
        deliveryStatus: "In-progress",
      });
    }
  });
  //user location update socket
  socket.on("locationUpdated", async (data) => {
    const location = [data.latitude, data.longitude];

    const agent = await Agent.findById(userId);

    const merchant = await Merchant.findById(userId);

    if (agent) {
      await Agent.findByIdAndUpdate(userId, {
        location,
      });
    } else if (merchant) {
      await Merchant.findByIdAndUpdate(userId, {
        "merchantDetail.location": location,
      });
    } else {
      await Customer.findByIdAndUpdate(userId, {
        "customerDetails.location": location,
      });
    }
  });
  //Order rejected socket
  socket.on("Rejected", () => {
    console.log("Task rejected");
  });
  //Agent reached drop location socket
  socket.on("reachedDropLocation", async () => {
    const agent = await Agent.findById(userId);
    if (agent) {
      const task = await Task.find({ agentId: userId });
      console.log(task);
      const order = await Order.findById(task[0].orderId);
      console.log(order);
      const maxRadius = 0.1;
      if (maxRadius > 0) {
        const customerLocation = order.orderDetail.deliveryLocation;
        const agentLocation = agent.location;
        const distance = turf.distance(
          turf.point(customerLocation),
          turf.point(agentLocation),
          { units: "kilometers" }
        );
        console.log(distance);
        if (distance < maxRadius) {
          const data = {
            message: "Agent reached your location",
            orderId: task.orderId,
            agentId: userId,
            agentName: agent.fullName,
          };
          const socketId = await getRecipientSocketId(order.customerId);
          console.log("CustomerSocket", socketId);
          socket.to(socketId).emit("agentReached", data);
        } else {
          const data = {
            message: "Not reached delivery location",
          };
          const socketId = await getRecipientSocketId(userId);
          console.log("AgentSocket", socketId);
          console.log("Data", data);
          io.to(socketId).emit("notReachedLocation", data);
        }
      }
    }
  });
  //Agent delivery completed
  socket.on("deliveryCompleted", async () => {
    const agent = await Agent.findByIdAndUpdate(userId, {
      status: "Free",
      $inc: { taskCompleted: 1 },
    });
    if (agent) {
      const task = await Task.find({ agentId: userId });
      const order = await Order.findByIdAndUpdate(task[0].orderId, {
        status: "Completed",
        "orderDetail.deliveryTime": new Date(),
      });
      console.log(task);
      await Task.findByIdAndUpdate(task[0].id, {
        deliveryStatus: "Completed",
      });
    }
  });
  //User  disconnected socket
  socket.on("disconnect", () => {
    console.log("user disconnected", socket.id);
    delete userSocketMap[userId];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

module.exports = { io, server, app, getRecipientSocketId };
