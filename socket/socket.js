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
const AgentNotificationLogs = require("../models/AgentNotificationLog");
const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const CustomerNotificationLogs = require("../models/CustomerNotificationLog");
const AdminNotificationLogs = require("../models/AdminNotificationLog");
const MerchantNotificationLogs = require("../models/MerchantNotificationLog");

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
  const userId = socket?.handshake?.query?.userId;
  const fcmToken = socket?.handshake?.query?.fcmToken;

  if (userId !== "null" && fcmToken !== "null") {
    const user = await FcmToken.findOne({ userId });

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
  socket.on("agentOrderAccepted", async ({ orderId, agentId }) => {
    const agent = await Agent.findById(agentId);

    if (agent.status === "Inactive") {
      throw new Error("Agent should be online to accept new order");
    }

    const task = await Task.findOne({ orderId }).populate("orderId");

    const orderFound = await Order.findById(orderId);

    const agentNotification = await AgentNotificationLogs.findOne({
      orderId: orderId,
      agentId: agentId,
    });

    if (agentNotification) {
      agentNotification.status = "Accepted";
      await agentNotification.save();
    } else {
      console.error("Agent notification not found");
    }

    const stepperDetail = {
      by: agent.fullName,
      userId: agent._id,
      date: new Date(),
    };

    await Order.findByIdAndUpdate(orderId, {
      agentId: agentId,
      "orderDetail.agentAcceptedAt": new Date(),
      "orderDetailStepper.assigned": stepperDetail,
    });

    if (task.taskStatus === "Unassigned" && agent.status === "Free") {
      await Task.findByIdAndUpdate(task[0]._id, {
        agentId,
        taskStatus: "Assigned",
        startTime: new Date(),
        "deliveryDetail.deliveryStatus": "Accepted",
        "pickupDetail.pickupStatus": "Started",
      });
    } else {
      await Task.findByIdAndUpdate(task._id, {
        agentId,
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
        customerId: orderFound.customerId,
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
  socket.on("agentOrderRejected", async ({ agentId, orderId }) => {
    try {
      const agentFound = await Agent.findById(agentId);

      if (!agentFound) {
        throw new Error("Agent not found");
      }

      agentFound.appDetail.cancelledOrders += 1;

      await Agent.save();

      const parameters = {
        eventName: "updateCancelledOrders",
        user: "Admin",
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

      sendNotification(
        process.env.ADMIN_ID,
        parameters.eventName,
        data,
        parameters.user
      );
    } catch (err) {
      throw new Error(`Error in updating cancelled orders of agent : ${err}`);
    }
  });

  // Update agent location to customer app and admin panel
  socket.on("agentLocationUpdateForUser", async ({ agentId }) => {
    const agent = await Agent.findById(agentId);

    if (agent) {
      sendSocketData(data.userId, "agentCurrentLocation", agent.location);
    }
  });

  // Update started stepper in order detail
  socket.on("agentPickupStarted", async ({ orderId, agentId }) => {
    try {
      const orderFound = await Order.findById(orderId);

      if (!orderFound) {
        throw new Error("Order not found");
      }

      const agentFound = await Agent.findById(agentId);

      const stepperDetail = {
        by: agentFound.fullName,
        userId: agentId,
        date: new Date(),
      };

      orderFound.orderDetailStepper.started = stepperDetail;

      await orderFound.save();

      const data = {
        socket: stepperDetail,
      };

      const parameters = {
        eventName: "agentPickupStarted",
        user: "Admin",
        role: "Merchant",
      };

      if (orderFound?.merchantId) {
        sendSocketData(
          orderFound.merchantId,
          parameters.eventName,
          data,
          parameters.role
        );
      }

      sendSocketData(
        process.env.ADMIN_ID,
        parameters.eventName,
        data.parameters.user
      );
    } catch (err) {
      throw new Error(`Error in starting pickup ${err}`);
    }
  });

  // Agent reached pickup location socket
  socket.on("reachedPickupLocation", async ({ agentId, taskId }) => {
    const agentFound = await Agent.findById(agentId);

    if (agentFound) {
      const taskFound = await Task.findOne({ _id: taskId, agentId });

      const orderFound = await Order.findById(taskFound.orderId);

      const parameters = {
        eventName: "reachedPickupLocation",
        user: "Customer",
        role: "Agent",
        role2: "Admin",
        role3: "Merchant",
      };

      const maxRadius = 0.1;
      if (maxRadius > 0) {
        const pickupLocation = taskFound?.pickupDetail?.pickupLocation;
        const agentLocation = agentFound.location;

        if (pickupLocation) {
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

            const customerData = {
              socket: {
                message: `${agentFound.fullName} has reached the pickup location`,
                orderId: taskFound.orderId,
                agentId: userId,
                agentName: agentFound.fullName,
              },
              fcm: {
                title: "Reached pickup",
                body: `${agentFound.fullName} has reached the pickup location`,
                customerId: orderFound.customerId,
              },
            };

            const adminData = {
              socket: stepperData,
            };

            sendNotification(
              orderFound.customerId,
              parameters.eventName,
              customerData,
              parameters.user
            );

            if (orderFound?.merchantId) {
              sendSocketData(
                orderFound.merchantId,
                parameters.eventName,
                adminData,
                parameters.role3
              );
            }

            sendSocketData(
              process.env.ADMIN_ID,
              parameters.eventName,
              adminData,
              parameters.role2
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
    }
  });

  // Started Delivery
  socket.on("agentDeliveryStarted", async ({ taskId, agentId }) => {
    try {
      const agentFound = await Agent.findById(agentId);
      const taskFound = await Task.findById(taskId);
      const orderFound = await Order.findbyId(taskFound.orderId);

      if (!agentFound || !taskFound || !orderFound) {
        throw new Error(`Agent or Task or Order not found`);
      }

      taskFound.pickupDetail.pickupStatus = "Completed";
      taskFound.deliveryDetail.deliveryStatus = "Started";

      await taskFound.save();

      const parameters = {
        eventName: "agentDeliveryStarted",
        user: "Customer",
        role: "Admin",
      };

      const data = {
        fcm: {
          title: "Order picked",
          body: `OrderID #${taskFound.orderId} has been picked by ${agentFound.fullName}`,
          orderId: taskFound.orderId,
          customerId: orderFound.customerId,
        },
      };

      sendNotification(
        process.env.ADMIN_ID,
        parameters.eventName,
        data,
        parameters.role
      );

      sendNotification(
        orderFound.customerId,
        parameters.eventName,
        data,
        parameters.user
      );
    } catch (err) {
      throw new Error(`Error in starting delivery trip: ${err}`);
    }
  });

  // Agent reached drop location socket
  socket.on("reachedDeliveryLocation", async ({ agentId, taskId }) => {
    const agentFound = await Agent.findById(agentId);
    const taskFound = await Task.findOne({ _id: taskId, agentId });
    const orderFound = await Order.findById(taskFound.orderId);

    if (!agentFound || !taskFound || !orderFound) {
      throw new Error("Agent / Task / Order not found");
    }

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

        const data = {
          socket: {
            title: "Order arrived",
            body: `${agentFound.fullName} has reached your location`,
          },
          fcm: {
            title: "Order arrived",
            body: `${agentFound.fullName} has reached your location`,
            customerId: orderFound.customerId,
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
          socket: {
            title: "Alert",
            body: `It seems like you have not reached the delivery location. Please try again after reaching the delivery location`,
          },
          fcm: {
            title: "Alert",
            body: `It seems like you have not reached the delivery location. Please try again after reaching the delivery location`,
            orderId: taskFound.orderId,
            pickupDetail: {},
            deliveryDetail: {},
            orderType: "",
            agentId,
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
  });

  // // Agent delivery completed
  // socket.on("deliveryCompleted", async (data) => {
  //   const { taskId, agentId } = data;

  //   const agent = await Agent.findByIdAndUpdate(agentId, {
  //     status: "Free",
  //     $inc: { taskCompleted: 1 },
  //   });

  //   if (agent) {
  //     const task = await Task.findOne({ _id: taskId, agentId });

  //     const order = await Order.findByIdAndUpdate(task.orderId, {
  //       status: "Completed",
  //     });

  //     const parameters = {
  //       eventName: "deliveryCompleted",
  //       user: "Customer",
  //     };

  //     const data = {
  //       fcm: {
  //         title: "Order Completed",
  //         body: `Your order ID #${order._id} has been completed successfully`,
  //       },
  //     };

  //     // Send notification to user
  //     sendNotification(
  //       task.customerId,
  //       parameters.eventName,
  //       data,
  //       parameters.user
  //     );
  //   }
  // });

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
    delete userSocketMap[userId].socketId;
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
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
