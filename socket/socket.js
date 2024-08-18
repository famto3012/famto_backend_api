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

const socketio = require("socket.io");
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
const CustomerNotificationLogs = require("../models/CustomerNotificationLog");
const AdminNotificationLogs = require("../models/AdminNotificationLog");
const MerchantNotificationLogs = require("../models/MerchantNotificationLog");

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
const io = socketio(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://famto-admin-panel-react.vercel.app",
      "*",
    ], // Replace with the correct URL of your React app
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
// function sendPushNotificationToUser(fcmToken, message, user, role) {
//   // console.log(message);
//   const mes = {
//     notification: {
//       title: message.title,
//       body: message.body,
//       image: message.image,
//     },
//     token: fcmToken,
//   };

//   getMessaging()
//     .send(mes)
//     .then((response) => {
//       console.log("Successfully sent message:", response);
//       if(role === "Admin"){

//       }

//     })
//     .catch((error) => {
//       console.log("Error sending message:", error);
//     });
// }

function sendPushNotificationToUser(fcmToken, message, user) {
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
    .then(async (response) => {
      console.log("Successfully sent message:", response);

      // Define the notification log data
      const logData = {
        imageUrl: message.image,
        title: message.title,
        description: message.body,
        ...(user !== "Customer" && { orderId: message.orderId }), // For agents, include orderId
      };

      console.log("Log Data:", logData);
      console.log("User Value:", user);
      // console.log("Role Value:", role);

      if (user === "Customer") {
        try {
          console.log("Inside customer");
          // Create CustomerNotificationLog
          await CustomerNotificationLogs.create({
            ...logData,
            customerId: message.customerId,
          });

          // If the role is admin, create an AdminNotificationLog too
          // if (role === "Admin") {
          //   console.log("Inside Admin");
          //   await AdminNotificationLogs.create(logData);
          // }
        } catch (err) {
          console.log(`Error in creating logs: ${err}`);
        }
      } else if (user === "Merchant") {
        try {
          // Create MerchantNotificationLog
          await MerchantNotificationLogs.create({
            ...logData,
            merchantId: message.merchantId,
          });

          // If the role is admin, create an AdminNotificationLog too
          // if (role === "Admin") {
          //   await AdminNotificationLogs.create(logData);
          // }
        } catch (err) {
          console.log(`Error in creating logs: ${err}`);
        }
      } else if (user === "Agent") {
        try {
          // Create AgentNotificationLog
          await AgentNotificationLogs.create({
            ...logData,
            agentId: message.agentId,
            pickupDetail: message.pickupDetail,
            deliveryDetail: message.deliveryDetail,
            orderType: message.orderType,
          });

          // If the role is admin, create an AdminNotificationLog too
          // if (role === "Admin") {
          //   await AdminNotificationLogs.create(logData);
          // }
        } catch (err) {
          console.log(`Error in creating logs: ${err}`);
        }
      } else if (user === "Admin") {
        try {
          await AdminNotificationLogs.create(logData);
        } catch (err) {
          console.log(`Error in creating logs: ${err}`);
        }
      }
    })
    .catch((error) => {
      console.log("Error sending message:", error);
    });
}

// Function to send notification to user (using Socket.IO if available, else FCM)
function sendNotification(userId, eventName, data, user) {
  const socketId = userSocketMap[userId]?.socketId;
  const fcmToken = userSocketMap[userId]?.fcmToken;
  console.log(socketId);
  console.log("User Value (Inside):", user);
  // console.log("Role Value (Inside):", role);
  console.log("Event Value (Inside):", eventName);
  if (socketId && fcmToken) {
    io.to(socketId).emit(eventName, data.socket);
    sendPushNotificationToUser(fcmToken, data.fcm, user);
  } else if (socketId) {
    io.to(socketId).emit(eventName, data.socket);
  } else if (fcmToken) {
    sendPushNotificationToUser(fcmToken, data.fcm, user);
  } else {
    console.error(`No socketId or fcmToken found for userId: ${userId}`);
  }
}

function sendSocketData(userId, eventName, data) {
  const socketId = userSocketMap[userId]?.socketId;
  if (socketId) {
    io.to(socketId).emit(eventName, data);
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

  // Order accepted by agent socket
  socket.on("agentOrderAccepted", async (data) => {
    const agent = await Agent.findById(data.agentId);

    if (agent.status === "Inactive") {
      throw new Error("Agent should be online to accept new order");
    }

    const task = await Task.findOne({ orderId: data.orderId }).populate(
      "orderId"
    );

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

    const stepperData = {
      by: agent.fullName,
      date: new Date(),
    };

    await Order.findByIdAndUpdate(data.orderId, {
      agentId: data.agentId,
      "orderDetail.agentAcceptedAt": new Date(),
      "stepperData.accepted": stepperData,
    });

    if (task.taskStatus === "Unassigned" && agent.status === "Free") {
      await Task.findByIdAndUpdate(task[0]._id, {
        agentId: data.agentId,
        taskStatus: "Assigned",
        startTime: new Date(),
        "deliveryDetail.deliveryStatus": "Accepted",
        "pickupDetail.pickupStatus": "Started",
      });
    } else {
      await Task.findByIdAndUpdate(task._id, {
        agentId: data.agentId,
        taskStatus: "Assigned",
        "deliveryDetail.deliveryStatus": "Accepted",
        "pickupDetail.pickupStatus": "Accepted",
      });
    }

    agent.status = "Busy";

    await agent.save();

    // Send notification to user
    const dataForCustomer = {
      socket: {
        agentName: agent.fullName,
        agentImgURL: agent.agentImageURL,
        customerId: task.orderId.customerId,
      },
      fcm: {
        title: "Agent assigned",
        body: `${agent.fullName} is your delivery partner`,
      },
    };

    const parameter = {
      eventName: "agentOrderAccepted",
      user: "Customer",
      role1: "Admin",
      role2: "Merchant",
    };

    sendNotification(
      task.customerId,
      parameter.eventName,
      dataForCustomer,
      parameter.user
    );

    sendSocketData(process.env.ADMIN_ID, parameter.eventName, parameter.role1);

    if (task?.orderId?.merchantId) {
      sendSocketData(
        task?.orderId?.merchantId,
        parameter.eventName,
        parameter.role2
      );
    }
  });

  // Order rejected socket
  socket.on("agentOrderRejected", async (data) => {
    try {
      const { agentId, orderId } = data;

      const agentFound = await Agent.findById(agentId);

      if (!agentFound) {
        throw new Error("Agent not found");
      }

      agentFound.appDetail.cancelledOrders += 1;

      await Agent.save();

      const parameters = {
        eventName: "updateCancelledOrders",
        role: "Admin",
      };

      const data = {
        socket: {
          title: "Order declined",
          body: `OrderID #${orderId} declined by delivery agent (${agentId})`,
          orderId,
        },
        fcm: {
          title: "Order declined",
          body: `OrderID #${orderId} declined by delivery agent (${agentId})`,
          orderId,
        },
      };

      sendSocketData(agentId, parameters.eventName, agentFound.appDetail);

      sendNotification(process.env.ADMIN_ID, parameters.eventName, data);
    } catch (err) {
      throw new Error(`Error in updating cancelled orders of agent : ${err}`);
    }
  });

  socket.on("agentLocationUpdateForUser", async (data) => {
    const agent = await Agent.findOne({ _id: data.agentId });
    if (agent) {
      sendSocketData(data.userId, "agentCurrentLocation", agent.location);
    }
  });

  // TODO: Complete socket connection
  socket.on("agentPickupStarted", async (data) => {
    try {
      const { orderId } = data;

      const orderFound = await Order.findById(orderId);

      if (!orderFound) {
        throw new Error("Order not found");
      }
    } catch (err) {
      throw new Error(`Error in starting pickup ${err}`);
    }
  });

  // Agent reached pickup location socket
  socket.on("reachedPickupLocation", async (data) => {
    const { agentId, taskId } = data;

    const agentFound = await Agent.findById(agentId);

    if (agentFound) {
      const taskFound = await Task.findOne({ _id: taskId, agentId });

      const orderFound = await Order.findById(taskFound.orderId);

      const parameters = {
        eventName: "reachedPickupLocation",
        user: "Customer",
        role: "Agent",
      };

      const maxRadius = 0.1;
      if (maxRadius > 0) {
        const pickupLocation = taskFound?.pickupDetail?.pickupLocation;
        const agentLocation = agentFound.location;

        const distance = turf.distance(
          turf.point(pickupLocation),
          turf.point(agentLocation),
          { units: "kilometers" }
        );

        if (distance < maxRadius) {
          const stepperData = {
            by: agentFound.fullName,
            userId: agentId,
            date: new Date(),
          };

          orderFound.orderDetailStepper.reachedPickupLocation = stepperData;

          await orderFound.save();

          const data = {
            socket: {
              message: `${agentFound.fullName} has reached the pickup location`,
              orderId: taskFound.orderId,
              agentId: userId,
              agentName: agentFound.fullName,
            },
            fcm: {
              title: "Reached pickup",
              body: `${agentFound.fullName} has reached the pickup location`,
            },
          };

          sendNotification(
            orderFound.customerId,
            parameters.eventName,
            data,
            parameters.user
          );
        } else {
          const data = {
            fcm: {
              title: "Alert",
              body: `It seems like you have not reached the pickup location. Please try again after reaching the pickup location`,
            },
          };

          sendNotification(
            agentFound._id,
            parameters.eventName,
            data,
            parameters.role
          );
        }
      }
    }
  });

  // Agent reached drop location socket
  socket.on("reachedDeliveryLocation", async (data) => {
    const { agentId, taskId } = data;

    const agentFound = await Agent.findById(agentId);

    if (agentFound) {
      const taskFound = await Task.findOne({ _id: taskId, agentId });

      const orderFound = await Order.findById(taskFound.orderId);

      const parameters = {
        eventName: "reachedDeliveryLocation",
        user: "Customer",
        role: "Agent",
      };

      const maxRadius = 0.1;
      if (maxRadius > 0) {
        const deliveryLocation = taskFound.deliveryDetail.deliveryLocation;
        const agentLocation = agentFound.location;

        const distance = turf.distance(
          turf.point(deliveryLocation),
          turf.point(agentLocation),
          { units: "kilometers" }
        );

        if (distance < maxRadius) {
          orderFound.orderDetail.deliveryTime = new Date();

          await orderFound.save();

          // TODO: need to send checkout delivery data to agent

          const data = {
            socket: {
              message: `${agentFound.fullName} has reached your location`,
              orderId: taskFound.orderId,
              agentId: userId,
              agentName: agentFound.fullName,
            },
            fcm: {
              title: "Order arrived",
              body: `${agentFound.fullName} has reached your location`,
            },
          };

          sendNotification(
            orderFound.customerId,
            parameters.eventName,
            data,
            parameters.user
          );
        } else {
          const data = {
            fcm: {
              title: "Alert",
              body: `It seems like you have not reached the delivery location. Please try again after reaching the delivery location`,
            },
          };

          sendNotification(agentFound._id, parameters.eventName, data);
        }
      }
    }
  });

  // Agent delivery completed
  socket.on("deliveryCompleted", async (data) => {
    const { taskId, agentId } = data;

    const agent = await Agent.findByIdAndUpdate(agentId, {
      status: "Free",
      $inc: { taskCompleted: 1 },
    });

    if (agent) {
      const task = await Task.findOne({ _id: taskId, agentId });

      const order = await Order.findByIdAndUpdate(task.orderId, {
        status: "Completed",
      });

      const parameters = {
        eventName: "deliveryCompleted",
        user: "Customer",
      };

      const data = {
        fcm: {
          title: "Order Completed",
          body: `Your order ID #${order._id} has been completed successfully`,
        },
      };

      // Send notification to user
      sendNotification(
        task.customerId,
        parameters.eventName,
        data,
        parameters.user
      );
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

  // socket.on("updateAgentStatusToggle", async ({ agentId, status }) => {
  //   try {
  //     await Agent.findByIdAndUpdate(agentId, {});
  //   } catch (err) {
  //     console.log(err);
  //   }
  // });

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
  sendSocketData,
};
