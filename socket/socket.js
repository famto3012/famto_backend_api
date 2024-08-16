// const { Server } = require("socket.io");
// const http = require("http");
// const express = require("express");
// const Task = require("../models/Task");
// const Agent = require("../models/Agent");
// const Customer = require("../models/Customer");
// const Merchant = require("../models/Merchant");
// const Order = require("../models/Order");
// const turf = require("@turf/turf");

// const app = express();
// const server = http.createServer(app);
// const io = new Server(server, {
//   cors: {
//     origin: "http://localhost:5173", // Replace with the correct URL of your React app
//     methods: ["GET", "POST"],
//     credentials: true,
//   },
//   pingInterval: 10000, // 10 seconds
//   pingTimeout: 5000, // 5 seconds
//   reconnection: true,
//   reconnectionAttempts: Infinity, // Unlimited attempts
//   //reconnectionDelay: 1000, // 1 second delay
//  //reconnectionDelayMax: 5000,
// });

// const getRecipientSocketId = (recipientId) => {
//   return userSocketMap[recipientId];
// };

// const userSocketMap = {};
// //Connection socket
// io.on("connection", (socket) => {
//   console.log("user connected", socket.id);
//   const userId = socket.handshake.query.userId;
//   if (userId != "undefined") userSocketMap[userId] = socket.id;
//   //Get online user socket
//   io.emit("getOnlineUsers", Object.keys(userSocketMap));
//   console.log(userSocketMap);
//   //Order accepted by agent socket
//   socket.on("Accepted", async (data) => {
//     const task = await Task.find({ orderId: data.orderId });
//     await Order.findByIdAndUpdate(data.orderId, {
//       agentId: data.agentId,
//     });
//     await Agent.findByIdAndUpdate(data.agentId, {
//       status: "Busy",
//     });
//     if (task.taskStatus === "Assigned") {
//       appError("Task already assigned");
//     } else {
//       await Task.findByIdAndUpdate(task[0]._id, {
//         agentId: data.agentId,
//         taskStatus: "Assigned",
//         deliveryStatus: "In-progress",
//       });
//     }
//   });
//   //user location update socket
//   socket.on("locationUpdated", async (data) => {
//     const location = [data.latitude, data.longitude];

//     const agent = await Agent.findById(userId);

//     const merchant = await Merchant.findById(userId);

//     if (agent) {
//       await Agent.findByIdAndUpdate(userId, {
//         location,
//       });
//     } else if (merchant) {
//       await Merchant.findByIdAndUpdate(userId, {
//         "merchantDetail.location": location,
//       });
//     } else {
//       await Customer.findByIdAndUpdate(userId, {
//         "customerDetails.location": location,
//       });
//     }
//   });
//   //Order rejected socket
//   socket.on("Rejected", () => {
//     console.log("Task rejected");
//   });
//   //Agent reached drop location socket
//   socket.on("reachedDropLocation", async () => {
//     const agent = await Agent.findById(userId);
//     if (agent) {
//       const task = await Task.find({ agentId: userId });
//       console.log(task);
//       const order = await Order.findById(task[0].orderId);
//       console.log(order);
//       const maxRadius = 0.1;
//       if (maxRadius > 0) {
//         const customerLocation = order.orderDetail.deliveryLocation;
//         const agentLocation = agent.location;
//         const distance = turf.distance(
//           turf.point(customerLocation),
//           turf.point(agentLocation),
//           { units: "kilometers" }
//         );
//         console.log(distance);
//         if (distance < maxRadius) {
//           const data = {
//             message: "Agent reached your location",
//             orderId: task.orderId,
//             agentId: userId,
//             agentName: agent.fullName,
//           };
//           const socketId = await getRecipientSocketId(order.customerId);
//           console.log("CustomerSocket", socketId);
//           socket.to(socketId).emit("agentReached", data);
//         } else {
//           const data = {
//             message: "Not reached delivery location",
//           };
//           const socketId = await getRecipientSocketId(userId);
//           console.log("AgentSocket", socketId);
//           console.log("Data", data);
//           io.to(socketId).emit("notReachedLocation", data);
//         }
//       }
//     }
//   });
//   //Agent delivery completed
//   socket.on("deliveryCompleted", async () => {
//     const agent = await Agent.findByIdAndUpdate(userId, {
//       status: "Free",
//       $inc: { taskCompleted: 1 },
//     });
//     if (agent) {
//       const task = await Task.find({ agentId: userId });
//       const order = await Order.findByIdAndUpdate(task[0].orderId, {
//         status: "Completed",
//         "orderDetail.deliveryTime": new Date(),
//       });
//       console.log(task);
//       await Task.findByIdAndUpdate(task[0].id, {
//         deliveryStatus: "Completed",
//       });
//     }
//   });
//   //User  disconnected socket
//   socket.on("disconnect", () => {
//     console.log("user disconnected", socket.id);
//     delete userSocketMap[userId];

//     io.emit("getOnlineUsers", Object.keys(userSocketMap));
//     // setTimeout(() => {
//     //  if (io.sockets.connected && io.sockets.connected[socket.id]) {
//     //     io.sockets.connected[socket.id].connect(); // Reconnect the socket
//     //   } else {
//     //     console.log("Socket not found for reconnection:", socket.id);
//     //   }
//     // }, 1000); //
//   });
// });

// module.exports = { io, server, app, getRecipientSocketId };

const { Server } = require("socket.io");
const http = require("http");
const express = require("express");
const Task = require("../models/Task");
const Agent = require("../models/Agent");
const Customer = require("../models/Customer");
const Merchant = require("../models/Merchant");
const turf = require("@turf/turf");
const admin = require("firebase-admin");
const Order = require("../models/Order");
const { getMessaging } = require("firebase-admin/messaging");
const FcmToken = require("../models/fcmToken");
const appError = require("../utils/appError");
const AgentNotificationLogs = require("../models/AgentNotificationLog");
const Message = require("../models/Message");
const Conversation = require("../models/Conversation");

// const serviceAccount = require("./path/to/serviceAccountKey.json");

const serviceAccount = {
  type: process.env.TYPE,
  project_id: process.env.PROJECT_ID,
  private_key_id: process.env.PRIVATE_KEY_ID,
  private_key: process.env.PRIVATE_KEY,
  client_email: process.env.CLIENT_EMAIL,
  client_id: process.env.CLIENT_ID,
  auth_uri: process.env.AUTH_URI,
  token_uri: process.env.TOKEN_URI,
  auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.CLIENT_X509_CERT_URL,
  universe_domain: process.env.UNIVERSE_DOMAIN,
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:5174", "*"], // Replace with the correct URL of your React app
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingInterval: 10000, // 10 seconds
  pingTimeout: 5000, // 5 seconds
  reconnection: true,
  reconnectionAttempts: Infinity, // Unlimited attempts
});

const userSocketMap = {};

// Function to send push notification via FCM
function sendPushNotificationToUser(fcmToken, message) {
  // console.log(message);
  const mes = {
    notification: {
      title: message.title,
      body: message.body,
      image: message.image,
    },
    token: fcmToken,
  };

  getMessaging()
    .send(mes)
    .then((response) => {
      console.log("Successfully sent message:", response);
    })
    .catch((error) => {
      console.log("Error sending message:", error);
    });
}

// Function to send notification to user (using Socket.IO if available, else FCM)
function sendNotification(userId, eventName, data) {
  const socketId = userSocketMap[userId]?.socketId;
  const fcmToken = userSocketMap[userId]?.fcmToken;
  console.log(socketId);
  if (socketId && fcmToken) {
    io.to(socketId).emit(eventName, data.socket);
    sendPushNotificationToUser(fcmToken, data.fcm);
  } else if (socketId) {
    io.to(socketId).emit(eventName, data.socket);
  } else if (fcmToken) {
    sendPushNotificationToUser(fcmToken, data.fcm);
  } else {
    console.error(`No socketId or fcmToken found for userId: ${userId}`);
  }
}

async function populateUserSocketMap() {
  try {
    const tokens = await FcmToken.find({});
    tokens.forEach((token) => {
      if (userSocketMap[token.userId]) {
        userSocketMap[token.userId].fcmToken = token.token;
      } else {
        userSocketMap[token.userId] = { socketId: null, fcmToken: token.token };
      }
    });
    //  console.log("User Socket Map populated with FCM tokens:", userSocketMap); //TODO: Uncomment
  } catch (error) {
    console.error("Error populating User Socket Map:", error);
  }
}

const getRecipientSocketId = (recipientId) => {
  return userSocketMap[recipientId].socketId;
};

const getRecipientFcmToken = (recipientId) => {
  return userSocketMap[recipientId].fcmToken;
};

// Connection socket
io.on("connection", async (socket) => {
  // console.log("user connected", socket.id);
  const userId = socket?.handshake?.query?.userId;
  const fcmToken = socket?.handshake?.query?.fcmToken;
  // const userId = null
  // const fcmToken = null
  // console.log("userId",typeof userId)
  // console.log("fcmToken",typeof fcmToken)
  // console.log("userId",userId)
  // console.log("fcmToken",fcmToken)

  if (userId !== "null" && fcmToken !== "null") {
    const user = await FcmToken.findOne({ userId });
    // console.log("Server", user);
    if (!user) {
      await FcmToken.create({
        userId,
        token: fcmToken,
      });
    } else {
      if (user.token === null || user.token !== fcmToken)
        await FcmToken.findByIdAndUpdate(user._id, {
          token: fcmToken,
        });
    }
  } else {
    console.error("Invalid user or FCM token provided");
    socket.disconnect();
    return;
  }

  if (userId !== "undefined") {
    if (userSocketMap[userId]) {
      userSocketMap[userId].socketId = socket.id;
    } else {
      userSocketMap[userId] = { socketId: socket.id, fcmToken };
    }
  }

  // Get online user socket
  io.emit("getOnlineUsers", Object.keys(userSocketMap));
  // console.log(userSocketMap);

  // Order accepted by agent socket
  socket.on("Accepted", async (data) => {
    const task = await Task.find({ orderId: data.orderId });

    const agentNotification = await AgentNotificationLogs.findOne({
      orderId: data.orderId,
      agentId: data.agentId,
    });
    if (agentNotification) {
      agentNotification.status = "Accepted";
      await agentNotification.save();
    } else {
      console.error("Agent notification not found");
    }

    await Order.findByIdAndUpdate(data.orderId, {
      agentId: data.agentId,
      "orderDetail.agentAcceptedAt": new Date(),
    });

    await Agent.findByIdAndUpdate(data.agentId, {
      status: "Busy",
    });

    if (task[0].taskStatus === "Assigned") {
      appError("Task already assigned");
    } else {
      await Task.findByIdAndUpdate(task[0]._id, {
        agentId: data.agentId,
        taskStatus: "Assigned",
        "deliveryDetail.deliveryStatus": "Accepted",
        "pickupDetail.pickupStatus": "Accepted",
      });
    }

    // Send notification to user
    sendNotification(task.customerId, "Accepted", data);
  });

  // User location update socket
  socket.on("locationUpdated", async (data) => {
    const location = [data.latitude, data.longitude];
    const agent = await Agent.findById(data.userId);
    const merchant = await Merchant.findById(data.userId);

    if (agent) {
      await Agent.findByIdAndUpdate(data.userId, {
        location,
      });
    } else if (merchant) {
      await Merchant.findByIdAndUpdate(data.userId, {
        "merchantDetail.location": location,
      });
    } else {
      await Customer.findByIdAndUpdate(data.userId, {
        "customerDetails.location": location,
      });
    }
  });

  // Order rejected socket
  socket.on("Rejected", () => {
    console.log("Task rejected");

    // Send notification to user
    sendNotification(userId, "Rejected", {});
  });

  // Agent reached drop location socket
  socket.on("reachedDropLocation", async () => {
    const agent = await Agent.findById(userId);
    if (agent) {
      const task = await Task.find({ agentId: userId });
      // console.log("Task", task);
      const order = await Order.findById(task[0].orderId);
      // console.log("Order", order);
      const maxRadius = 0.1;
      if (maxRadius > 0) {
        const customerLocation = order.orderDetail.deliveryLocation;
        const agentLocation = agent.location;
        const distance = turf.distance(
          turf.point(customerLocation),
          turf.point(agentLocation),
          { units: "kilometers" }
        );
        // console.log(distance);
        if (distance < maxRadius) {
          // const data = {
          //   message: "Agent reached your location",
          //   orderId: task.orderId,
          //   agentId: userId,
          //   agentName: agent.fullName,
          // };
          // const socketId = userSocketMap[order.customerId]?.socketId;
          // console.log("CustomerSocket", socketId);
          // if (socketId) {
          //   io.to(socketId).emit("agentReached", data);
          // } else {
          //   const fcmToken = userSocketMap[order.customerId]?.fcmToken;
          //   if (fcmToken) {
          //     sendPushNotificationToUser(fcmToken, {
          //       title: "Agent reached your location",
          //       body: `Agent ${agent.fullName} has reached your location for order ${task.orderId}`,
          //     });
          //   }
          // }
          const data = {
            socket: {
              message: "Agent reached your location",
              orderId: task.orderId,
              agentId: userId,
              agentName: agent.fullName,
            },
            fcm: `Agent ${agent.fullName} has reached your location for order ${task.orderId}`,
          };
          sendNotification(agent.id, "agentReached", data);
        } else {
          // const data = {
          //   message: "Not reached delivery location",
          // };
          // const socketId = userSocketMap[userId]?.socketId;
          // console.log("AgentSocket", socketId);
          // console.log("Data", data);
          // if (socketId) {
          //   io.to(socketId).emit("notReachedLocation", data);
          // } else {
          //   const fcmToken = userSocketMap[userId]?.fcmToken;
          //   if (fcmToken) {
          //     sendPushNotificationToUser(fcmToken, {
          //       title: "Not reached delivery location",
          //       body: "Agent has not reached the delivery location.",
          //     });
          //   }
          // }
          const data = {
            socket: {
              message: "Not reached delivery location",
              orderId: task.orderId,
              agentId: userId,
              agentName: agent.fullName,
            },
            fcm: `Agent ${agent.fullName} has not reached your location for order ${task.orderId}`,
          };
          sendNotification(agent.id, "notReachedLocation", data);
        }
      }
    }
  });

  // Agent delivery completed
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
      // console.log(task);
      await Task.findByIdAndUpdate(task[0].id, {
        "deliveryDetail.deliveryStatus": "Completed",
      });

      // Send notification to user
      sendNotification(task.customerId, "deliveryCompleted", {});
    }
  });

  socket.on("markMessagesAsSeen", async ({ conversationId, userId }) => {
    try {
      await Message.updateMany(
        { conversationId: conversationId, seen: false },
        { $set: { seen: true } }
      );
      await Conversation.updateOne(
        { _id: conversationId },
        { $set: { "lastMessage.seen": true } }
      );
      io.to(userSocketMap[userId].socketId).emit("messagesSeen", {
        conversationId,
      });
    } catch (error) {
      console.log(error);
    }
  });

  // User disconnected socket
  socket.on("disconnect", () => {
    // console.log("user disconnected", socket.id);
    delete userSocketMap[userId].socketId;
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
    // console.log(userSocketMap);
    // No need to send notification here because it's handled in sendNotification function
  });
});

module.exports = {
  io,
  server,
  app,
  getRecipientSocketId,
  getRecipientFcmToken,
  sendNotification,
  userSocketMap,
  populateUserSocketMap,
  sendPushNotificationToUser,
};
