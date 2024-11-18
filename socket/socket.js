const socketio = require("socket.io");
const http = require("http");
const fs = require("fs");
const https = require("https");
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
const {
  getDistanceFromPickupToDelivery,
  getDeliveryAndSurgeCharge,
} = require("../utils/customerAppHelpers");
const {
  calculateAgentEarnings,
  updateAgentDetails,
} = require("../utils/agentAppHelpers");
const NotificationSetting = require("../models/NotificationSetting");
const Admin = require("../models/Admin");

const admin1 = require("firebase-admin");
const admin2 = require("firebase-admin");
const { MessagePort } = require("worker_threads");
const CustomerPricing = require("../models/CustomerPricing");

const serviceAccount1 = {
  type: process.env.TYPE_1,
  project_id: process.env.PROJECT_ID_1,
  private_key_id: process.env.PRIVATE_KEY_ID_1,
  private_key: process.env.PRIVATE_KEY_1,
  client_email: process.env.CLIENT_EMAIL_1,
  client_id: process.env.CLIENT_ID_1,
  auth_uri: process.env.AUTH_URI_1,
  token_uri: process.env.TOKEN_URI_1,
  auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL_1,
  client_x509_cert_url: process.env.CLIENT_X509_CERT_URL_1,
  universe_domain: process.env.UNIVERSE_DOMAIN_1,
};

const serviceAccount2 = {
  type: process.env.TYPE_2,
  project_id: process.env.PROJECT_ID_2,
  private_key_id: process.env.PRIVATE_KEY_ID_2,
  private_key: process.env.PRIVATE_KEY_2,
  client_email: process.env.CLIENT_EMAIL_2,
  client_id: process.env.CLIENT_ID_2,
  auth_uri: process.env.AUTH_URI_2,
  token_uri: process.env.TOKEN_URI_2,
  auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL_2,
  client_x509_cert_url: process.env.CLIENT_X509_CERT_URL_2,
  universe_domain: process.env.UNIVERSE_DOMAIN_2,
};

const app1 = admin1.initializeApp(
  {
    credential: admin1.credential.cert(serviceAccount1),
  },
  "project1"
);

const app2 = admin2.initializeApp(
  {
    credential: admin2.credential.cert(serviceAccount2),
  },
  "project2"
);

const app = express();
const server = http.createServer(app);

const io = socketio(server, {
  transports: ["websocket"],
  cors: {
    origin: ["https://dashboard.famto.in", "http://localhost:8080"], // Replace with the correct URL of your React app
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  },
  pingInterval: 10000, // 10 seconds
  pingTimeout: 5000, // 5 seconds
  reconnection: true,
  reconnectionAttempts: Infinity, // Unlimited attempts
});

const userSocketMap = {};

const sendPushNotificationToUser = async (fcmToken, message, eventName) => {
  const notificationSettings = await NotificationSetting.findOne({
    event: eventName,
  });

  const mes = {
    notification: {
      title: notificationSettings?.title || message.title,
      body: notificationSettings?.description || message.body,
      image: message?.image,
    },
    data: {
      orderId: message?.orderId || "",
      merchantName: message?.merchantName || "",
      pickAddress: JSON.stringify(message?.pickAddress || {}),
      customerName: message?.customerName || "",
      customerAddress: JSON.stringify(message?.customerAddress || {}),
      orderType: message?.orderType || "",
      taskDate: message?.taskDate || "",
      taskTime: message?.taskTime || "",
      timer: JSON.stringify(message?.timer || ""),
    },
    webpush: {
      fcm_options: {
        link: "https://dashboard.famto.in/home",
      },
      notification: {
        icon: "https://firebasestorage.googleapis.com/v0/b/famto-aa73e.appspot.com/o/admin_panel_assets%2FGroup%20427320384.svg?alt=media&token=0be47a53-43f3-4887-9822-3baad0edd31e",
      },
    },
    token: fcmToken,
  };
  console.log(mes);

  try {
    // Try sending with the first project
    const response1 = await admin1.messaging(app1).send(mes);
    console.log("Successfully sent message with project1:", response1);
    return true; // Return true if the notification was sent successfully with project1
  } catch (error1) {
    console.error("Error sending message with project1:", error1);

    try {
      const response2 = await admin2.messaging(app2).send(mes);
      console.log("Successfully sent message with project2:", response2);
      return true; // Return true if the notification was sent successfully with project2
    } catch (error2) {
      console.error("Error sending message with project2:", error2);
      return false; // Return false if there was an error with both projects
    }
  }
};

const createNotificationLog = async (notificationSettings, message) => {
  const logData = {
    imageUrl: message?.image,
    title: notificationSettings?.title,
    description: notificationSettings?.description,
    ...(!notificationSettings?.customer && { orderId: message?.orderId }),
  };

  try {
    if (notificationSettings?.customer) {
      try {
        await CustomerNotificationLogs.create({
          ...logData,
          customerId: message?.customerId,
        });
      } catch (err) {
        console.log(`Error in creating Customer notification log: ${err}`);
      }
    }

    if (notificationSettings?.merchant) {
      try {
        // console.log("Data", logData);
        await MerchantNotificationLogs.create({
          ...logData,
          merchantId: message?.merchantId,
          orderId: message?.orderId,
        });
      } catch (err) {
        console.log(`Error in creating Merchant notification log: ${err}`);
      }
    }

    if (notificationSettings?.driver) {
      try {
        const notificationFound = await AgentNotificationLogs.findOne({
          agentId: message?.agentId,
          orderId: message?.orderId,
          status: "Pending",
        });

        if (notificationFound) {
          await AgentNotificationLogs.findByIdAndDelete(notificationFound._id);
        }

        await AgentNotificationLogs.create({
          ...logData,
          agentId: message?.agentId,
          orderId: message?.orderId,
          pickupDetail: {
            name: message?.pickupDetail?.fullName,
            address: {
              fullName: message?.pickupDetail?.fullName,
              phoneNumber: message?.pickupDetail?.phoneNumber,
              flat: message?.pickupDetail?.flat,
              area: message?.pickupDetail?.area,
              landmark: message?.pickupDetail?.landmark,
            },
          },
          deliveryDetail: {
            name: message?.deliveryDetail?.fullName,
            address: {
              fullName: message?.deliveryDetail?.fullName,
              phoneNumber: message?.deliveryDetail?.phoneNumber,
              flat: message?.deliveryDetail?.flat,
              area: message?.deliveryDetail?.area,
              landmark: message?.deliveryDetail?.landmark,
            },
          },
          orderType: message?.orderType,
        });
      } catch (err) {
        console.log(`Error in creating agent notification log: ${err.message}`);
      }
    }

    if (notificationSettings?.admin) {
      await AdminNotificationLogs.create({
        ...logData,
        orderId: message?.orderId,
      });
    }
  } catch (err) {
    console.error(`Error in creating logs: ${err}`);
  }
};

// Function to send notification to user (using Socket.IO if available, else FCM)
const sendNotification = async (userId, eventName, data, role) => {
  const { fcmToken } = userSocketMap[userId] || {};
  let notificationSent = false;

  const notificationSettings = await NotificationSetting.findOne({
    event: eventName,
  });

  if (fcmToken && !notificationSent) {
    notificationSent = await sendPushNotificationToUser(
      fcmToken,
      data.fcm,
      eventName
    );
  }
  console.log("Notification send", notificationSent);

  if (notificationSent) {
    await createNotificationLog(notificationSettings, data.fcm);
  } else {
    console.error(`No socketId or fcmToken found for userId: ${userId}`);
  }
};

const sendSocketData = (userId, eventName, data) => {
  const socketId = userSocketMap[userId]?.socketId;
  console.log("Event", eventName);
  console.log("SocketId", socketId);
  console.log("data", data);

  if (socketId) io.to(socketId).emit(eventName, data);

  console.log("socketId", socketId);
  console.log("eventName", eventName);
};

const populateUserSocketMap = async () => {
  try {
    const tokens = await FcmToken.find({});
    tokens.forEach((token) => {
      if (userSocketMap[token.userId]) {
        userSocketMap[token.userId].fcmToken = token.token;
      } else {
        userSocketMap[token.userId] = { socketId: null, fcmToken: token.token };
      }
    });

    // console.log("User socket map", userSocketMap);
  } catch (error) {
    console.error("Error populating User Socket Map:", error);
  }
};

const getRecipientSocketId = (recipientId) => {
  return userSocketMap[recipientId].socketId;
};

const getRecipientFcmToken = (recipientId) => {
  return userSocketMap[recipientId].fcmToken;
};

const findRolesToNotify = async (eventName) => {
  try {
    // Fetch notification settings to determine roles
    const notificationSettings = await NotificationSetting.findOne({
      event: eventName,
    });

    console.log("notificationSettings", notificationSettings);

    const rolesToNotify = ["admin", "merchant", "driver", "customer"].filter(
      (role) => notificationSettings[role]
    );

    const data = {
      title: notificationSettings.title,
      description: notificationSettings.description,
    };

    return { rolesToNotify, data };
  } catch (err) {
    throw new Error(err.message);
  }
};

const getRealTimeDataCountMerchant = async (data) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    let pending, ongoing, completed, cancelled;
    console.log(data);
    if (data.id && data.role === "Merchant") {
      [pending, ongoing, completed, cancelled] = await Promise.all([
        Order.countDocuments({
          status: "Pending",
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          merchantId: data.id,
        }),
        Order.countDocuments({
          status: "On-going",
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          merchantId: data.id,
        }),
        Order.countDocuments({
          status: "Completed",
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          merchantId: data.id,
        }),
        Order.countDocuments({
          status: "Cancelled",
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          merchantId: data.id,
        }),
      ]);
    } else {
      [pending, ongoing, completed, cancelled] = await Promise.all([
        Order.countDocuments({
          status: "Pending",
          createdAt: { $gte: startOfDay, $lte: endOfDay },
        }),
        Order.countDocuments({
          status: "On-going",
          createdAt: { $gte: startOfDay, $lte: endOfDay },
        }),
        Order.countDocuments({
          status: "Completed",
          createdAt: { $gte: startOfDay, $lte: endOfDay },
        }),
        Order.countDocuments({
          status: "Cancelled",
          createdAt: { $gte: startOfDay, $lte: endOfDay },
        }),
      ]);
    }

    const [free, inActive, busy] = await Promise.all([
      Agent.countDocuments({ status: "Free" }),
      Agent.countDocuments({ status: "Inactive" }),
      Agent.countDocuments({ status: "Busy" }),
    ]);

    const today = new Date()
      .toLocaleString("en-IN", { weekday: "short" })
      .toLowerCase();

    // Counting active and not active merchants
    const [open, closed] = await Promise.all([
      Merchant.countDocuments({
        status: true,
      }),

      Merchant.countDocuments({
        status: false,
      }),
    ]);

    const [active, notActive] = await Promise.all([
      Merchant.countDocuments({
        "merchantDetail.pricing.0": { $exists: true },
        "merchantDetail.pricing.modelType": { $exists: true }, // Ensures modelType exists
        "merchantDetail.pricing.modelId": { $exists: true },
      }), // active merchants
      Merchant.countDocuments({
        "merchantDetail.pricing.0": { $exists: false },
        "merchantDetail.pricing.modelType": { $exists: true }, // Ensures modelType exists
        "merchantDetail.pricing.modelId": { $exists: true },
      }), // inactive merchants
    ]);

    const realTimeData = {
      orderCount: {
        pending,
        ongoing,
        completed,
        cancelled,
      },
      agentCount: {
        free,
        inActive,
        busy,
      },
      merchantCount: {
        open,
        closed,
        active,
        notActive,
      },
    };

    // console.log("Emitting real-time data:", realTimeData);
    io.emit("realTimeDataCount", realTimeData);
  } catch (err) {
    console.error("Error updating real-time data:", err);
  }
};

const getRealTimeDataCount = async () => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const [pending, ongoing, completed, cancelled] = await Promise.all([
      Order.countDocuments({
        status: "Pending",
        createdAt: { $gte: startOfDay, $lte: endOfDay },
      }),
      Order.countDocuments({
        status: "On-going",
        createdAt: { $gte: startOfDay, $lte: endOfDay },
      }),
      Order.countDocuments({
        status: "Completed",
        createdAt: { $gte: startOfDay, $lte: endOfDay },
      }),
      Order.countDocuments({
        status: "Cancelled",
        createdAt: { $gte: startOfDay, $lte: endOfDay },
      }),
    ]);

    const [free, inActive, busy] = await Promise.all([
      Agent.countDocuments({ status: "Free" }),
      Agent.countDocuments({ status: "Inactive" }),
      Agent.countDocuments({ status: "Busy" }),
    ]);

    const today = new Date()
      .toLocaleString("en-IN", { weekday: "short" })
      .toLowerCase();

    // Counting active and not active merchants
    const [open, closed] = await Promise.all([
      Merchant.countDocuments({
        status: true,
      }),

      Merchant.countDocuments({
        status: false,
      }),
    ]);

    const [active, notActive] = await Promise.all([
      Merchant.countDocuments({
        "merchantDetail.pricing.0": { $exists: true },
        "merchantDetail.pricing.modelType": { $exists: true }, // Ensures modelType exists
        "merchantDetail.pricing.modelId": { $exists: true },
      }), // active merchants
      Merchant.countDocuments({
        "merchantDetail.pricing.0": { $exists: false },
        "merchantDetail.pricing.modelType": { $exists: true }, // Ensures modelType exists
        "merchantDetail.pricing.modelId": { $exists: true },
      }), // inactive merchants
    ]);

    const realTimeData = {
      orderCount: {
        pending,
        ongoing,
        completed,
        cancelled,
      },
      agentCount: {
        free,
        inActive,
        busy,
      },
      merchantCount: {
        open,
        closed,
        active,
        notActive,
      },
    };

    // console.log("Emitting real-time data:", realTimeData);
    io.emit("realTimeDataCount", realTimeData);
  } catch (err) {
    console.error("Error updating real-time data:", err);
  }
};

// Example of listening for changes
Order.watch().on("change", async (change) => {
  getRealTimeDataCount();
});

// Example of listening for changes
Merchant.watch().on("change", async (change) => {
  getRealTimeDataCount();
});

// Example of listening for changes
Agent.watch().on("change", async (change) => {
  getRealTimeDataCount();
});

// Connection socket
io.on("connection", async (socket) => {
  const userId = socket?.handshake?.query?.userId;
  const fcmToken = socket?.handshake?.query?.fcmToken;

  if (userId !== "null" && fcmToken !== "null") {
    console.log("UserId", userId);
    console.log("fcmToken", fcmToken);
    const user = await FcmToken.findOne({ userId });

    if (!user) {
      await FcmToken.create({
        userId,
        token: fcmToken,
      });
    } else {
      if (user.token === null || user.token !== fcmToken) {
        await FcmToken.findByIdAndUpdate(user._id, {
          token: fcmToken,
        });
      }
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

  // Get realtime data count for Home page
  socket.on("getRealTimeDataOnRefresh", () => {
    getRealTimeDataCount();
  });

  socket.on("getRealTimeDataOnRefreshMerchant", (data) => {
    getRealTimeDataCountMerchant(data);
  });

  // User location update socket
  socket.on("locationUpdated", async (data) => {
    const location = [data.latitude, data.longitude];
    const agent = await Agent.findById(data.userId);
    const merchant = await Merchant.findById(data.userId);

    if (agent) {
      console.log(
        `AgentId: ${data.userId} | Location: ${data.latitude} ${data.longitude}}`
      );

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
    try {
      console.log("Trying to accept order");

      console.log("agentId", agentId);
      console.log("orderId", orderId);

      const agent = await Agent.findById(agentId);

      if (!agent)
        return socket.emit("error", {
          message: "Agent not found",
          success: false,
        });

      if (agent.status === "Inactive") {
        return socket.emit("error", {
          message: "Agent should be online to accept new order",
          success: false,
        });
      }

      const [task, orderFound, agentNotification] = await Promise.all([
        Task.findOne({ orderId }).populate("orderId"),
        Order.findById(orderId),
        AgentNotificationLogs.findOne({
          orderId,
          agentId,
        }),
      ]);

      if (agentNotification) {
        console.log("Have notification");
        agentNotification.status = "Accepted";
        await agentNotification.save();
      } else {
        console.log("Don't have notification");
        return socket.emit("error", {
          message: "Notification log of agent is not found",
          success: false,
        });
      }

      const stepperDetail = {
        by: agent.fullName,
        userId: agent._id,
        date: new Date(),
        location: agent?.location,
      };

      await Order.findByIdAndUpdate(orderId, {
        agentId: agentId,
        "orderDetail.agentAcceptedAt": new Date(),
        "orderDetailStepper.assigned": stepperDetail,
      });

      if (task.taskStatus === "Unassigned" && agent.status === "Free") {
        await Task.findByIdAndUpdate(task._id, {
          agentId,
          taskStatus: "Assigned",
          startTime: new Date(),
          "deliveryDetail.deliveryStatus": "Accepted",
          "pickupDetail.pickupStatus": "Started",
          "deliveryDetail.deliveryStatus": "Accepted",
        });

        if (orderFound.orderDetail.deliveryMode === "Custom Order") {
          const data = {
            location: agent.location,
            status: "Initial location",
          };

          // Initialize detailsAddedByAgents if it does not exist
          if (!orderFound.detailAddedByAgent) {
            orderFound.detailAddedByAgent = { shopUpdates: [] };
          }

          // Initialize shopUpdates if it does not exist
          let shopUpdates = orderFound?.detailAddedByAgent?.shopUpdates || [];

          shopUpdates.push(data);
        }

        await orderFound.save();
      } else {
        await Task.findByIdAndUpdate(task._id, {
          agentId,
          taskStatus: "Assigned",
          "pickupDetail.pickupStatus": "Accepted",
          "deliveryDetail.deliveryStatus": "Accepted",
        });
      }

      agent.status = "Busy";
      agent.appDetail.pendingOrder -= 1;

      await agent.save();

      const eventName = "agentOrderAccepted";

      const { rolesToNotify, data } = await findRolesToNotify(eventName);

      // Send notifications to each role dynamically
      for (const role of rolesToNotify) {
        let roleId;

        if (role === "admin") {
          roleId = process.env.ADMIN_ID;
        } else if (role === "merchant") {
          roleId = orderFound?.merchantId;
        } else if (role === "driver") {
          roleId = orderFound?.agentId;
        } else if (role === "customer") {
          roleId = orderFound?.customerId;
        }

        if (roleId) {
          const notificationData = {
            fcm: {
              customerId: orderFound.customerId,
            },
          };

          await sendNotification(
            roleId,
            eventName,
            notificationData,
            role.charAt(0).toUpperCase() + role.slice(1)
          );
        }
      }

      const socketData = {
        ...data,
        agentName: agent.fullName,
        agentImgURL: agent.agentImageURL,
        customerId: task.orderId.customerId,
        orderDetailStepper: stepperDetail,
        success: true,
      };

      sendSocketData(orderFound.customerId, eventName, socketData);
      sendSocketData(process.env.ADMIN_ID, eventName, socketData);
      if (task?.orderId?.merchantId) {
        sendSocketData(task?.orderId?.merchantId, eventName, socketData);
      }

      console.log("Order accepted successfully");
    } catch (err) {
      console.log("Error in accepting order" + err);

      socket.emit("error", {
        message: err.message,
        success: false,
      });
    }
  });

  // Order rejected socket
  socket.on("agentOrderRejected", async ({ orderId, agentId }) => {
    try {
      console.log("Trying to reject order");

      const [agentFound, orderFound, agentNotification] = await Promise.all([
        Agent.findById(agentId),
        Order.findById(orderId),
        AgentNotificationLogs.findOne({
          orderId,
          agentId,
        }),
      ]);

      if (!agentFound)
        return socket.emit("error", {
          message: "Agent not found",
          success: false,
        });

      if (!orderFound)
        return socket.emit("error", {
          message: "Order not found",
          success: false,
        });

      if (agentNotification) {
        agentNotification.status = "Rejected";
        await agentNotification.save();
      } else {
        return socket.emit("error", {
          message: "Agent notification not found",
          success: false,
        });
      }

      agentFound.appDetail.pendingOrder -= 1;
      agentFound.appDetail.cancelledOrders += 1;

      await agentFound.save();

      const eventName = "agentOrderRejected";

      const { rolesToNotify, data } = await findRolesToNotify(eventName);

      // Send notifications to each role dynamically
      for (const role of rolesToNotify) {
        let roleId;

        if (role === "admin") {
          roleId = process.env.ADMIN_ID;
        } else if (role === "merchant") {
          roleId = orderFound?.merchantId;
        } else if (role === "driver") {
          roleId = orderFound?.agentId;
        } else if (role === "customer") {
          roleId = orderFound?.customerId;
        }

        if (roleId) {
          const notificationData = {
            fcm: {
              ...data,
              agentId,
              orderId,
            },
          };

          await sendNotification(
            roleId,
            eventName,
            notificationData,
            role.charAt(0).toUpperCase() + role.slice(1)
          );
        }
      }

      sendSocketData(agentId, parameters.eventName, agentFound.appDetail);

      console.log("Successfully rejected order");
    } catch (err) {
      console.log("Failed to reject order :" + err);

      return socket.emit("error", {
        message: `Error in rejecting order by agent: ${err}`,
        success: false,
      });
    }
  });

  // Update agent location to customer app and admin panel
  socket.on("agentLocationUpdateForUser", async ({ orderId }) => {
    const order = await Order.findById(orderId);
    if (order?.status !== "Completed" && order?.status !== "Cancelled") {
      const agent = await Agent.findById(order?.agentId);
      if (agent) {
        const data = {
          agentLocation: agent?.location,
        };
        sendSocketData(order?.customerId, "agentCurrentLocation", data);
      } else {
        const data = {
          message: "Agent not assigned to this order",
        };
        sendSocketData(order?.customerId, "agentCurrentLocation", data);
      }
    } else {
      const data = {
        message: "Order is already completed or cancelled",
      };
      sendSocketData(order?.customerId, "agentCurrentLocation", data);
    }
  });

  // Update started stepper in order detail
  socket.on("agentPickupStarted", async ({ taskId, agentId }) => {
    try {
      console.log("Agent attempting to start pick up");
      console.log("Agent Id: ", agentId);
      console.log("Task Id: ", taskId);

      const taskFound = await Task.findById(taskId);
      if (!taskFound) {
        console.log("Task not found");
        return socket.emit("error", {
          message: "Task not found",
          success: false,
        });
      }

      const orderFound = await Order.findById(taskFound.orderId);
      if (!orderFound) {
        console.log("Order not found");
        return socket.emit("error", {
          message: "Order not found",
          success: false,
        });
      }

      const agentFound = await Agent.findById(agentId);
      if (!agentFound) {
        console.log("Agent not found");
        return socket.emit("error", {
          message: "Agent not found",
          success: false,
        });
      }

      if (taskFound.pickupDetail.pickupStatus === "Completed") {
        console.log("Pickup has already been completed");
        return socket.emit("error", {
          message: "Pickup is already completed",
          success: false,
        });
      }

      const stepperDetail = {
        by: agentFound.fullName,
        userId: agentId,
        date: new Date(),
        location: agentFound.location,
      };

      // Initialize orderDetailStepper if it does not exist
      if (!orderFound.orderDetailStepper) orderFound.orderDetailStepper = {};

      orderFound.orderDetailStepper.pickupStarted = stepperDetail;
      orderFound.orderDetail.agentStartedAt = new Date();
      taskFound.pickupDetail.pickupStatus = "Started";

      if (
        orderFound.orderDetail.deliveryMode === "Custom Order" &&
        (!orderFound.orderDetail.pickupLocation ||
          orderFound.orderDetail.pickupLocation.length !== 2)
      ) {
        const data = {
          location: agentFound.location,
          status: "Initial location",
        };

        // Initialize detailAddedByAgent and shopUpdates if not present
        if (!orderFound.detailAddedByAgent) {
          orderFound.detailAddedByAgent = { shopUpdates: [] };
        }

        orderFound.detailAddedByAgent.shopUpdates.push(data);
      }

      await Promise.all([orderFound.save(), taskFound.save()]);

      const eventName = "agentPickupStarted";

      const data = {
        orderDetailStepper: stepperDetail,
        success: true,
      };

      sendSocketData(process.env.ADMIN_ID, eventName, data);
      sendSocketData(orderFound.customerId, eventName, data);
      if (orderFound?.merchantId) {
        sendSocketData(orderFound.merchantId, eventName, data);
      }

      console.log("Agent successfully started pick up");
      console.log("Agent Id: ", agentId);
      console.log("Task Id: ", taskId);
    } catch (err) {
      console.log("Agent failed to start pick up");
      console.log("Agent Id: ", agentId);
      console.log("Task Id: ", taskId);
      console.log("Message: ", err);

      return socket.emit("error", {
        message: `Error in starting pickup: ${err}`,
        success: false,
      });
    }
  });

  // Agent reached pickup location socket
  // socket.on("reachedPickupLocation", async ({ taskId, agentId }) => {
  //   try {
  //     console.log("Agent attempting to reach pick up");
  //     console.log("Agent Id: ", agentId);
  //     console.log("Task Id: ", taskId);

  //     const [agentFound, taskFound] = await Promise.all([
  //       Agent.findById(agentId),
  //       Task.findOne({ _id: taskId, agentId }),
  //     ]);

  //     if (!agentFound)
  //       return socket.emit("error", { message: "Agent not found" });

  //     if (!taskFound)
  //       return socket.emit("error", { message: "Task not found" });

  //     const orderFound = await Order.findById(taskFound.orderId);
  //     if (!orderFound) {
  //       return socket.emit("error", { message: "Order not found" });
  //     }

  //     const eventName = "reachedPickupLocation";
  //     const { rolesToNotify, data } = await findRolesToNotify(eventName);

  //     const maxRadius = 0.25;
  //     if (maxRadius > 0) {
  //       const pickupLocation = taskFound?.pickupDetail?.pickupLocation;
  //       const agentLocation = agentFound.location;

  //       if (pickupLocation) {
  //         console.log("Have Pickup location");

  //         const distance = turf.distance(
  //           turf.point(pickupLocation),
  //           turf.point(agentLocation),
  //           { units: "kilometers" }
  //         );

  //         if (distance < maxRadius) {
  //           console.log("Agent Reached near to pick up");

  //           const stepperDetail = {
  //             by: agentFound.fullName,
  //             userId: agentId,
  //             date: new Date(),
  //             location: agentFound.location,
  //           };

  //           orderFound.orderDetailStepper.reachedPickupLocation = stepperDetail;

  //           taskFound.pickupDetail.pickupStatus = "Completed";

  //           await taskFound.save();
  //           await orderFound.save();

  //           // Send notifications to each role dynamically
  //           for (const role of rolesToNotify) {
  //             let roleId;

  //             if (role === "admin") {
  //               roleId = process.env.ADMIN_ID;
  //             } else if (role === "merchant") {
  //               roleId = orderFound?.merchantId;
  //             } else if (role === "driver") {
  //               roleId = orderFound?.agentId;
  //             } else if (role === "customer") {
  //               roleId = orderFound?.customerId;
  //             }

  //             if (roleId) {
  //               const notificationData = {
  //                 fcm: {
  //                   customerId: orderFound.customerId,
  //                 },
  //               };

  //               await sendNotification(
  //                 roleId,
  //                 eventName,
  //                 notificationData,
  //                 role.charAt(0).toUpperCase() + role.slice(1)
  //               );
  //             }
  //           }

  //           const socketData = {
  //             ...data,
  //             orderId: taskFound.orderId,
  //             agentId: userId,
  //             agentName: agentFound.fullName,
  //             orderDetailStepper: stepperDetail,
  //           };

  //           sendSocketData(orderFound.customerId, eventName, socketData);
  //           sendSocketData(process.env.ADMIN_ID, eventName, socketData);
  //           if (orderFound?.merchantId) {
  //             sendSocketData(orderFound.merchantId, eventName, socketData);
  //           }
  //         } else {
  //           console.log("Agent haven't reached near to pick up");

  //           const event = "agentNotReachedPickupLocation";

  //           const { data } = await findRolesToNotify(event);

  //           const dataToSend = {
  //             ...data,
  //             orderId: taskFound.orderId,
  //             agentId,
  //           };

  //           await sendNotification(
  //             agentId,
  //             event,
  //             dataToSend,
  //             role.charAt(0).toUpperCase() + role.slice(1)
  //           );

  //           return socket.emit("error", {
  //             message: "Agent is far from pickup point",
  //           });
  //         }
  //       }
  //     }

  //     console.log("Agent successfully reached pick up");
  //     console.log("Agent Id: ", agentId);
  //     console.log("Task Id: ", taskId);
  //   } catch (err) {
  //     console.log("Agent failed to reach pick up");
  //     console.log("Agent Id: ", agentId);
  //     console.log("Task Id: ", taskId);
  //     console.log("Message: ", err);

  //     return socket.emit("error", {
  //       message: `Error in reaching pickup location: ${err}`,
  //     });
  //   }
  // });

  socket.on("reachedPickupLocation", async ({ taskId, agentId }) => {
    try {
      console.log("Agent attempting to reach pick up");
      console.log("Agent Id: ", agentId);
      console.log("Task Id: ", taskId);

      // Fetch agent and task data in parallel
      const [agentFound, taskFound] = await Promise.all([
        Agent.findById(agentId),
        Task.findOne({ _id: taskId, agentId }),
      ]);

      if (!agentFound) {
        console.log("Agent not found");
        return socket.emit("error", {
          message: "Agent not found",
          success: false,
        });
      }

      if (!taskFound) {
        console.log("Task not found");
        return socket.emit("error", {
          message: "Task not found",
          success: false,
        });
      }

      const orderFound = await Order.findById(taskFound.orderId);
      if (!orderFound) {
        console.log("Order not found");
        return socket.emit("error", {
          message: "Order not found",
          success: false,
        });
      }

      const eventName = "reachedPickupLocation";
      const { rolesToNotify, data } = await findRolesToNotify(eventName);

      const maxRadius = 0.25; // 250 meters in kilometers
      const pickupLocation = taskFound?.pickupDetail?.pickupLocation;
      const agentLocation = agentFound.location;

      if (
        !pickupLocation ||
        !Array.isArray(pickupLocation) ||
        pickupLocation.length !== 2
      ) {
        console.log("Invalid pickup location data");
        return socket.emit("error", {
          message: "Invalid pickup location data",
          success: false,
        });
      }

      if (
        !agentLocation ||
        !Array.isArray(agentLocation) ||
        agentLocation.length !== 2
      ) {
        console.log("Invalid agent location data");
        return socket.emit("error", {
          message: "Invalid agent location data",
          success: false,
        });
      }

      console.log("Pickup Location: ", pickupLocation);
      console.log("Agent Location: ", agentLocation);

      const distance = turf.distance(
        turf.point(pickupLocation),
        turf.point(agentLocation),
        { units: "kilometers" }
      );

      console.log("Distance: ", distance);

      if (distance < maxRadius) {
        console.log("Agent Reached near to pick up");

        const stepperDetail = {
          by: agentFound.fullName,
          userId: agentId,
          date: new Date(),
          location: agentFound.location,
        };

        orderFound.orderDetailStepper.reachedPickupLocation = stepperDetail;
        taskFound.pickupDetail.pickupStatus = "Completed";

        await taskFound.save();
        await orderFound.save();

        // Send notifications to each role dynamically
        for (const role of rolesToNotify) {
          let roleId;

          if (role === "admin") {
            roleId = process.env.ADMIN_ID;
          } else if (role === "merchant") {
            roleId = orderFound?.merchantId;
          } else if (role === "driver") {
            roleId = orderFound?.agentId;
          } else if (role === "customer") {
            roleId = orderFound?.customerId;
          }

          if (roleId) {
            const notificationData = {
              fcm: {
                customerId: orderFound.customerId,
              },
            };

            await sendNotification(
              roleId,
              eventName,
              notificationData,
              role.charAt(0).toUpperCase() + role.slice(1)
            );
          }
        }

        const socketData = {
          ...data,
          orderId: taskFound.orderId,
          agentId: agentId,
          agentName: agentFound.fullName,
          orderDetailStepper: stepperDetail,
          success: true,
        };

        const event = "agentReachedPickupLocation";

        const socketDataForAgent = {
          message: "Agent reached pickup location",
          success: true,
        };

        sendSocketData(orderFound.customerId, eventName, socketData);
        sendSocketData(process.env.ADMIN_ID, eventName, socketData);
        if (orderFound?.merchantId) {
          sendSocketData(orderFound.merchantId, eventName, socketData);
        }
        sendSocketData(agentId, event, socketDataForAgent);

        console.log("Agent successfully reached pick up");
      } else {
        console.log("Agent hasn't reached near the pickup location");

        const event = "agentNotReachedPickupLocation";

        const { data } = await findRolesToNotify(event);

        const dataToSend = {
          ...data,
          orderId: taskFound.orderId,
          agentId,
        };

        await sendNotification(agentId, event, dataToSend, "Agent");

        return socket.emit("error", {
          message: "Agent is far from pickup point",
          success: false,
        });
      }
    } catch (err) {
      console.error("Agent failed to reach pick up");
      console.error("Agent Id: ", agentId);
      console.error("Task Id: ", taskId);
      console.error("Error Message: ", err);

      return socket.emit("error", {
        message: `Error in reaching pickup location: ${err.message || err}`,
        success: false,
      });
    }
  });

  // Started Delivery
  socket.on("agentDeliveryStarted", async ({ taskId, agentId }) => {
    try {
      console.log("Agent attempting to start delivery");
      console.log("Agent Id: ", agentId);
      console.log("Task Id: ", taskId);

      const [agentFound, taskFound] = await Promise.all([
        Agent.findById(agentId),
        Task.findById(taskId),
      ]);

      if (!agentFound) {
        return socket.emit("error", {
          message: "Agent not found",
          success: false,
        });
      }

      if (!taskFound) {
        return socket.emit("error", {
          message: "Task not found",
          success: false,
        });
      }

      const orderFound = await Order.findById(taskFound.orderId).populate(
        "customerId",
        "customerDetails.geofenceId"
      );

      if (!orderFound) {
        return socket.emit("error", {
          message: "Order not found",
          success: false,
        });
      }

      taskFound.pickupDetail.pickupStatus = "Completed";
      taskFound.deliveryDetail.deliveryStatus = "Started";

      if (orderFound?.orderDetail?.deliveryMode === "Custom Order") {
        const customerPricing = await CustomerPricing.findOne({
          deliveryMode: "Custom Order",
          geofenceId: orderFound?.customerId?.customerDetails?.geofenceId,
          status: true,
        });

        if (!customerPricing) {
          return socket.emit("error", {
            message: `Customer pricing for custom order not found`,
            success: false,
          });
        }

        const waitingFare = customerPricing.waitingFare;
        const waitingTime = customerPricing.waitingTime;

        const now = new Date();
        const reachedTime = taskFound?.pickupDetail?.completedTime;

        const diffInMs = now - reachedTime;

        // Convert the difference to minutes
        const diffInMinutes = Math.floor(diffInMs / 60000);

        if (diffInMinutes - waitingTime > 0) {
          let calculatedWaitingFare = 0;

          calculatedWaitingFare = parseFloat(
            waitingFare * (diffInMinutes - waitingTime)
          );

          orderFound.billDetail.waitingCharges = calculatedWaitingFare;

          await orderFound.save();
        }
      }

      await taskFound.save();

      const eventName = "agentDeliveryStarted";

      const { rolesToNotify, data } = await findRolesToNotify(eventName);

      const stepperDetail = {
        by: agentFound.fullName,
        userId: agentId,
        date: new Date(),
        location: agentFound.location,
      };

      orderFound.orderDetailStepper.deliveryStarted = stepperDetail;

      await orderFound.save();

      // Send notifications to each role dynamically
      for (const role of rolesToNotify) {
        let roleId;

        if (role === "admin") {
          roleId = process.env.ADMIN_ID;
        } else if (role === "merchant") {
          roleId = orderFound?.merchantId;
        } else if (role === "driver") {
          roleId = orderFound?.agentId;
        } else if (role === "customer") {
          roleId = orderFound?.customerId;
        }

        if (roleId) {
          const notificationData = {
            fcm: {
              customerId: orderFound.customerId,
              orderId: taskFound.orderId,
            },
          };

          await sendNotification(
            roleId,
            eventName,
            notificationData,
            role.charAt(0).toUpperCase() + role.slice(1)
          );
        }
      }

      const socketData = {
        orderDetailStepper: stepperDetail,
      };

      sendSocketData(process.env.ADMIN_ID, eventName, socketData);
      sendSocketData(orderFound?.customerId, eventName, socketData);
      if (orderFound?.merchantId) {
        sendSocketData(orderFound?.merchantId, eventName, socketData);
      }

      const socketId = userSocketMap[agentId]?.socketId;

      if (socketId)
        io.to(socketId).emit("agentDeliveryStarted", {
          data: "Delivery successfully started",
          success: true,
        });

      console.log("Agent successfully started delivery");
      console.log("Agent Id: ", agentId);
      console.log("Task Id: ", taskId);
    } catch (err) {
      console.log("Agent failed to start delivery");
      console.log("Agent Id: ", agentId);
      console.log("Task Id: ", taskId);
      console.log("Message: ", err);

      return socket.emit("error", {
        message: `Error in starting delivery trip: ${err}`,
        success: false,
      });
    }
  });

  // Agent reached drop location socket
  socket.on("reachedDeliveryLocation", async ({ taskId, agentId }) => {
    try {
      console.log("Agent attempting to reach delivery");
      console.log("Agent Id: ", agentId);
      console.log("Task Id: ", taskId);

      const agentFound = await Agent.findById(agentId);
      if (!agentFound) {
        return socket.emit("error", {
          message: "Agent not found",
          success: false,
        });
      }

      const taskFound = await Task.findOne({ _id: taskId, agentId });
      if (!taskFound) {
        return socket.emit("error", {
          message: "Task not found",
          success: false,
        });
      }

      const orderFound = await Order.findById(taskFound.orderId).populate(
        "customerId",
        "customerDetails.geofenceId"
      );

      if (!orderFound) {
        return socket.emit("error", {
          message: "Order not found",
          success: false,
        });
      }

      const eventName = "reachedDeliveryLocation";

      const { rolesToNotify } = await findRolesToNotify(eventName);

      const maxRadius = 0.25;
      if (maxRadius > 0) {
        const deliveryLocation = taskFound.deliveryDetail.deliveryLocation;
        const agentLocation = agentFound.location;

        const distance = turf.distance(
          turf.point(deliveryLocation),
          turf.point(agentLocation),
          { units: "kilometers" }
        );
        if (distance < maxRadius) {
          console.log("Agent reached delivery");
          if (orderFound?.orderDetail?.deliveryMode === "Custom Order") {
            const customerPricing = await CustomerPricing.findOne({
              deliveryMode: "Custom Order",
              geofenceId: orderFound?.customerId?.customerDetails?.geofenceId,
              status: true,
            });

            if (!customerPricing) {
              return socket.emit("error", {
                message: `Customer pricing for custom order not found`,
                success: false,
              });
            }

            const startTime = orderFound?.orderDetail?.agentStartedAt;
            const now = new Date();

            const diffInMs = now - startTime;

            // Convert the difference to minutes
            const diffInHours = Math.ceil(diffInMs / 3600000);

            if (diffInHours > 0) {
              let calculatedDeliveryFare = 0;

              calculatedDeliveryFare = parseFloat(
                diffInHours * customerPricing.purchaseFarePerHour
              );

              orderFound.billDetail.deliveryCharge = calculatedDeliveryFare;

              await orderFound.save();
            }
          }

          const stepperDetail = {
            by: agentFound.fullName,
            userId: agentId,
            date: new Date(),
            location: agentFound.location,
          };

          orderFound.orderDetailStepper.reachedDeliveryLocation = stepperDetail;
          orderFound.orderDetail.deliveryTime = new Date();

          taskFound.deliveryDetail.deliveryStatus = "Completed";
          taskFound.taskStatus = "Completed";

          await Promise.all([orderFound.save(), taskFound.save()]);

          // Send notifications to each role dynamically
          for (const role of rolesToNotify) {
            let roleId;

            if (role === "admin") {
              roleId = process.env.ADMIN_ID;
            } else if (role === "merchant") {
              roleId = orderFound?.merchantId;
            } else if (role === "driver") {
              roleId = orderFound?.agentId;
            } else if (role === "customer") {
              roleId = orderFound?.customerId;
            }

            if (roleId) {
              const notificationData = {
                fcm: {
                  customerId: orderFound.customerId,
                },
              };

              await sendNotification(
                roleId,
                eventName,
                notificationData,
                role.charAt(0).toUpperCase() + role.slice(1)
              );
            }
          }

          const socketData = {
            orderDetailStepper: stepperDetail,
            success: true,
          };

          const event = "agentReachedDeliveryLocation";

          const socketDataForAgent = {
            message: "Agent reached delivery location",
            success: true,
          };

          sendSocketData(process.env.ADMIN_ID, eventName, socketData);
          sendSocketData(orderFound.customerId, eventName, socketData);
          sendSocketData(agentId, event, socketDataForAgent);
        } else {
          console.log("Agent is far from delivery point");
          const event = "agentNotReachedDeliveryLocation";

          const { data } = await findRolesToNotify(event);

          const dataToSend = {
            ...data,
            orderId: taskFound.orderId,
            agentId,
          };

          await sendNotification(agentId, event, dataToSend, "Agent");

          return socket.emit("error", {
            message: "Agent is far from delivery point",
            success: false,
          });
        }
      }

      console.log("Agent successfully to reach delivery point");
      console.log("Agent Id: ", agentId);
      console.log("Task Id: ", taskId);
    } catch (err) {
      console.log("Agent failed to reach delivery");
      console.log("Agent Id: ", agentId);
      console.log("Task Id: ", taskId);
      console.log("Message: ", err);

      return socket.emit("error", {
        message: `Error in reaching delivery location`,
        success: false,
      });
    }
  });

  // Mark message as seen in customer agent message chat
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
      return socket.emit("error", {
        message: `Error in marking message as seen: ${err}`,
      });
    }
  });

  // Cancel Custom order
  socket.on(
    "cancelCustomOrderByAgent",
    async ({ status, description, orderId, latitude, longitude }) => {
      try {
        console.log(status);
        console.log(description);
        console.log(orderId);
        console.log(latitude);
        console.log(longitude);

        const orderFound = await Order.findById(orderId);
        if (!orderFound) {
          return socket.emit("error", { message: "Order not found" });
        }

        const taskFound = await Task.findOne({ orderId });
        if (!taskFound) {
          return socket.emit("error", { message: "Task not found" });
        }

        const agentFound = await Agent.findById(orderFound.agentId);
        if (!agentFound) {
          return socket.emit("error", { message: "Agent not found" });
        }

        const dataByAgent = {
          location: [latitude, longitude],
          status,
          description,
        };

        console.log("dataByAgent", dataByAgent);

        let oldDistance = orderFound.orderDetail?.distance || 0;

        const lastLocation =
          orderFound.detailAddedByAgent.shopUpdates.length > 0
            ? orderFound.detailAddedByAgent.shopUpdates[
                orderFound.detailAddedByAgent.shopUpdates.length - 1
              ].location
            : null;

        const { distanceInKM } = await getDistanceFromPickupToDelivery(
          dataByAgent.location,
          lastLocation
        );

        console.log("distanceInKM", distanceInKM);

        const newDistance = parseFloat(distanceInKM);

        orderFound.orderDetail.distance = oldDistance + newDistance;

        // Calculate delivery charges
        const { deliveryCharges } = await getDeliveryAndSurgeCharge(
          orderFound.customerId,
          orderFound.orderDetail.deliveryMode,
          distanceInKM
        );

        console.log("deliveryCharges", deliveryCharges);

        let oldDeliveryCharge = orderFound.billDetail?.deliveryCharge || 0;
        let oldGrandTotal = orderFound.billDetail?.grandTotal || 0;

        orderFound.billDetail.deliveryCharge =
          oldDeliveryCharge + parseFloat(deliveryCharges);

        orderFound.billDetail.grandTotal =
          oldGrandTotal + parseFloat(deliveryCharges);

        // Initialize pickupLocation if needed
        if (
          !orderFound.orderDetail.pickupLocation &&
          (shopUpdates.length === 0 || shopUpdates === null)
        ) {
          orderFound.orderDetail.pickupLocation =
            orderFound.detailAddedByAgent.shopUpdates[
              orderFound.detailAddedByAgent.shopUpdates.length - 1
            ].location;
        }

        console.log("Here");

        const currentTime = new Date();
        let delayedBy = null;

        if (currentTime > new Date(orderFound.orderDetail.deliveryTime)) {
          delayedBy =
            currentTime - new Date(orderFound.orderDetail.deliveryTime);
        }

        orderFound.orderDetail.deliveryTime = currentTime;
        orderFound.orderDetail.timeTaken =
          currentTime - new Date(orderFound.orderDetail.agentAcceptedAt);
        orderFound.orderDetail.delayedBy = delayedBy;

        orderFound.detailAddedByAgent.shopUpdates.push(dataByAgent);
        orderFound.status = "Cancelled";

        taskFound.pickupDetail.pickupStatus = "Cancelled";
        taskFound.deliveryDetail.deliveryStatus = "Cancelled";

        // Calculate earnings for agent
        const calculatedSalary = await calculateAgentEarnings(
          agentFound,
          orderFound
        );

        // Update agent details
        await updateAgentDetails(
          agentFound,
          orderFound,
          calculatedSalary,
          false
        );

        const stepperDetail = {
          by: agentFound.fullName,
          userId: agentFound._id,
          date: new Date(),
          location: agentFound.location,
        };

        orderFound.orderStepperDetil.cancelled = stepperDetail;

        await Promise.all([
          orderFound.save(),
          taskFound.save(),
          agentFound.save(),
        ]);

        console.log("Here 2");

        const eventName = "cancelCustomOrderByAgent";

        const { rolesToNotify, data } = await findRolesToNotify(eventName);

        // Send notifications to each role dynamically
        for (const role of rolesToNotify) {
          let roleId;

          if (role === "admin") {
            roleId = process.env.ADMIN_ID;
          } else if (role === "merchant") {
            roleId = orderFound?.merchantId;
          } else if (role === "driver") {
            roleId = orderFound?.agentId;
          } else if (role === "customer") {
            roleId = orderFound?.customerId;
          }

          if (roleId) {
            const notificationData = {
              fcm: {
                ...data,
                orderId: orderFound._id,
                customerId: orderFound.customerId,
              },
            };

            await sendNotification(
              roleId,
              eventName,
              notificationData,
              role.charAt(0).toUpperCase() + role.slice(1)
            );
          }
        }

        const socketData = {
          stepperDetail,
        };

        sendSocketData(orderFound.customerId, eventName, socketData);
        sendSocketData(process.env.ADMIN_ID, eventName, socketData);
      } catch (err) {
        return socket.emit("error", {
          message: `Error in cancelling custom order by agent: ${err}`,
        });
      }
    }
  );

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
  findRolesToNotify,
  getRealTimeDataCount,
};
