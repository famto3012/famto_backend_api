const appError = require("../../../../utils/appError");
const { validationResult } = require("express-validator");
const {
  deleteFromFirebase,
  uploadToFirebase,
} = require("../../../../utils/imageOperation");
const AlertNotification = require("../../../../models/AlertNotification");
const MerchantNotificationLogs = require("../../../../models/MerchantNotificationLog");
const {
  sendNotification,
  sendSocketData,
} = require("../../../../socket/socket");
const CustomerNotificationLogs = require("../../../../models/CustomerNotificationLog");
const AgentNotificationLogs = require("../../../../models/AgentNotificationLog");
const AgentAnnouncementLogs = require("../../../../models/AgentAnnouncementLog");
const AdminNotificationLogs = require("../../../../models/AdminNotificationLog");

const addAlertNotificationController = async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    let formattedErrors = {};
    errors.array().forEach((error) => {
      formattedErrors[error.param] = error.msg;
    });
    return res.status(400).json({ errors: formattedErrors });
  }

  try {
    const { title, description, userType, id } = req.body;

    let imageUrl = "";
    if (req.file) {
      imageUrl = await uploadToFirebase(req.file, "alertNotificationImage");
    }

    // Determine which ID field to set based on the boolean flags
    let alertNotificationData = {
      title,
      description,
      imageUrl,
    };

    if (userType === "merchant") {
      alertNotificationData.merchantId = id;
      alertNotificationData.merchant = true;

      const merchant = await MerchantNotificationLogs.create({
        merchantId: id,
        title,
        description,
        imageUrl,
      });

      const data = {
        socket: {
          title,
          description,
          imageUrl,
          createdAt: merchant.createdAt,
        },
        fcm: {
          title: title,
          body: description,
          image: imageUrl,
        },
      };

      sendNotification(id, "alertNotification", data);
      const event = "alertNotification";
      sendSocketData(id, event, data.socket);
      sendSocketData(process.env.ADMIN_ID, event, data.socket);
    } else if (userType === "agent") {
      alertNotificationData.agentId = id;
      alertNotificationData.agent = true;
      const agent = await AgentAnnouncementLogs.create({
        agentId: id,
        title,
        description,
        imageUrl,
       
      });
      const data = {
        socket: {
          title,
          description,
          imageUrl,
          createdAt: agent.createdAt,
        },
        fcm: {
          title: title,
          body: description,
          image: imageUrl,
        },
      };
      sendNotification(id, "alertNotification", data);
      const event = "alertNotification";
      sendSocketData(id, event, data.socket);
      sendSocketData(process.env.ADMIN_ID, event, data.socket);
    } else if (userType === "customer") {
      alertNotificationData.customerId = id;
      alertNotificationData.customer = true;
     const customer = await CustomerNotificationLogs.create({
        customerId: id,
        title,
        description,
        imageUrl,
      });
      const data = {
        socket: {
          title,
          description,
          imageUrl,
          createdAt: customer.createdAt,
        },
        fcm: {
          title: title,
          body: description,
          image: imageUrl,
        },
      };
      sendNotification(id, "alertNotification", data);
      const event = "alertNotification";
      sendSocketData(id, event, data.socket);
      sendSocketData(process.env.ADMIN_ID, event, data.socket);
    } else {
      return next(
        appError(
          "Invalid role specified. Please specify either merchant, agent, or customer."
        )
      );
    }

    // Create a new alert notification
    const newAlertNotification = new AlertNotification(alertNotificationData);

    // Save the alert notification to the database
    await newAlertNotification.save();

    await AdminNotificationLogs.create({
      title,
      description,
      imageUrl,
    });

    res.status(201).json({
      message: "Alert notification added successfully!",
      alertNotification: newAlertNotification,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const deleteAlertNotificationController = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Find the alert notification by ID and delete it
    const deletedAlertNotification = await AlertNotification.findOne({
      _id: id,
    });

    if (!deletedAlertNotification) {
      return res.status(404).json({ error: "Alert Notification not found" });
    } else {
      await deleteFromFirebase(deletedAlertNotification.imageUrl);
      await AlertNotification.findByIdAndDelete(id);
    }

    res.status(200).json({
      message: "Alert notification deleted successfully!",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAllAlertNotificationsController = async (req, res, next) => {
  try {
    // Fetch all alert notifications from the database
    const alertNotifications = await AlertNotification.find();

    res.status(200).json({
      message: "Alert notifications retrieved successfully!",
      data: alertNotifications,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAlertNotificationsByUserTypeController = async (req, res, next) => {
  try {
    const { userType } = req.params;

    let query = {};

    if (userType === "merchant") {
      query.merchant = true;
    } else if (userType === "agent") {
      query.agent = true;
    } else if (userType === "customer") {
      query.customer = true;
    } else {
      return next(
        appError(
          "Invalid user type specified. Please specify either merchant, agent, or customer.",
          400
        )
      );
    }

    // Fetch alert notifications by user type from the database
    const alertNotifications = await AlertNotification.find(query);
    res.status(200).json({
      message: "Alert notifications retrieved successfully!",
      alertNotifications,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const searchAlertNotificationsByTitleController = async (req, res, next) => {
  try {
    const { title } = req.query;

    if (!title) {
      return next(appError("Title query parameter is required", 400));
    }

    // Fetch alert notifications by title from the database
    const alertNotifications = await AlertNotification.find({
      title: { $regex: title, $options: "i" }, // Case-insensitive search
    });

    res.status(200).json({
      message: "Alert notifications retrieved successfully!",
      alertNotifications,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  addAlertNotificationController,
  deleteAlertNotificationController,
  getAllAlertNotificationsController,
  getAlertNotificationsByUserTypeController,
  searchAlertNotificationsByTitleController,
};
