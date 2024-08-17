const appError = require("../../../utils/appError");
const { validationResult } = require("express-validator");
const NotificationSetting = require("../../../models/NotificationSetting");
const PushNotification = require("../../../models/PushNotification");
const {
  uploadToFirebase,
  deleteFromFirebase,
} = require("../../../utils/imageOperation");
const { sendNotification } = require("../../../socket/socket");
const Merchant = require("../../../models/Merchant");
const Customer = require("../../../models/Customer");
const Agent = require("../../../models/Agent");
const AgentNotificationLogs = require("../../../models/AgentNotificationLog");

const addNotificationSettingController = async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    let formattedErrors = {};
    errors.array().forEach((error) => {
      formattedErrors[error.param] = error.msg;
    });
    return res.status(400).json({ errors: formattedErrors });
  }

  try {
    const {
      event,
      description,
      admin,
      merchant,
      driver,
      customer,
      whatsapp,
      sms,
      email,
    } = req.body;

    const newNotificationSetting = new NotificationSetting({
      event,
      description,
      admin,
      merchant,
      driver,
      customer,
      whatsapp,
      sms,
      email,
    });

    await newNotificationSetting.save();

    res.status(201).json({
      success: "Notification setting created successfully",
      data: newNotificationSetting,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const editNotificationSettingController = async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    let formattedErrors = {};
    errors.array().forEach((error) => {
      formattedErrors[error.param] = error.msg;
    });
    return res.status(400).json({ errors: formattedErrors });
  }

  try {
    const {
      event,
      description,
      admin,
      merchant,
      driver,
      customer,
      whatsapp,
      sms,
      email,
    } = req.body;

    const updatedNotificationSetting =
      await NotificationSetting.findByIdAndUpdate(
        req.params.id,
        {
          event,
          description,
          admin,
          merchant,
          driver,
          customer,
          whatsapp,
          sms,
          email,
        },
        { new: true }
      );

    if (!updatedNotificationSetting) {
      return res.status(404).json({ error: "Notification setting not found" });
    }

    res.status(200).json({
      success: "Notification Setting updated successfully",
      data: updatedNotificationSetting,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const deleteNotificationSettingController = async (req, res, next) => {
  try {
    const deletedNotificationSetting =
      await NotificationSetting.findByIdAndDelete(req.params.id);

    if (!deletedNotificationSetting) {
      return res.status(404).json({ error: "Notification setting not found" });
    }

    res.status(200).json({
      success: "Notification setting deleted successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAllNotificationSettingController = async (req, res) => {
  try {
    const notificationSettings = await NotificationSetting.find();
    res.status(200).json({
      success: "Notification setting found",
      data: notificationSettings,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getNotificationSettingController = async (req, res) => {
  try {
    const notificationSettingId = req.params.notificationSettingId;
    const notificationSettings = await NotificationSetting.findOne({
      _id: notificationSettingId,
    });
    res.status(200).json({
      success: "Notification setting found",
      data: notificationSettings,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const searchNotificationSettingController = async (req, res, next) => {
  try {
    const { query } = req.query;

    const searchTerm = query.trim();

    const searchResults = await NotificationSetting.find({
      event: { $regex: searchTerm, $options: "i" },
    });

    res.status(200).json({
      message: "Searched notification setting results",
      data: searchResults,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const addPushNotificationController = async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    let formattedErrors = {};
    errors.array().forEach((error) => {
      formattedErrors[error.param] = error.msg;
    });
    return res.status(400).json({ errors: formattedErrors });
  }

  try {
    const { title, description, geofence, merchant, driver, customer } =
      req.body;

    let imageUrl = "";
    if (req.file) {
      imageUrl = await uploadToFirebase(req.file, "PushNotificationImages");
    }

    const newPushNotification = new PushNotification({
      title,
      description,
      geofence,
      imageUrl,
      merchant,
      driver,
      customer,
    });

    const savedPushNotification = await newPushNotification.save();

    res.status(201).json({
      success: "Push Notification created successfully",
      data: savedPushNotification,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const deletePushNotificationController = async (req, res, next) => {
  try {
    const { id } = req.params;

    const deletedPushNotification = await PushNotification.findOne({ _id: id });

    if (!deletedPushNotification) {
      return res.status(404).json({ error: "Push Notification not found" });
    } else {
      await deleteFromFirebase(deletedPushNotification.imageUrl);
      await PushNotification.findByIdAndDelete(id);
    }

    res.status(200).json({
      success: "Push Notification deleted successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const searchPushNotificationController = async (req, res, next) => {
  try {
    const { query } = req.query;

    const searchTerm = query.trim();

    const searchResults = await PushNotification.find({
      title: { $regex: searchTerm, $options: "i" },
    });

    res.status(200).json({
      message: "Searched push notification results",
      data: searchResults,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAllPushNotificationController = async (req, res) => {
  try {
    const pushNotification = await PushNotification.find();
    res.status(200).json({
      success: "Push Notification found",
      data: pushNotification,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const fetchPushNotificationController = async (req, res, next) => {
  try {
    const { type } = req.query;

    if (!["merchant", "driver", "customer"].includes(type)) {
      return res.status(400).json({ error: "Invalid type parameter" });
    }

    const query = {};
    query[type] = true;

    const pushNotifications = await PushNotification.find(query);

    res.status(200).json({
      success: "Push Notifications fetched successfully",
      data: pushNotifications,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const addAlertNotificationController = async (req, res, next) => {
  try {
    const { title, description, imageUrl, merchant, agent, customer, id } =
      req.body;

    // Determine which ID field to set based on the boolean flags
    let alertNotificationData = {
      title,
      description,
      imageUrl,
      merchant,
      agent,
      customer,
    };

    if (merchant) {
      alertNotificationData.merchantId = id;
    } else if (agent) {
      alertNotificationData.agentId = id;
    } else if (customer) {
      alertNotificationData.customerId = id;
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

    res.status(201).json({
      message: "Alert notification added successfully!",
      alertNotification: newAlertNotification,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const sendNotificationController = async (req, res, next) => {
  const { userId, eventName, data } = req.body;
  try {
    const merchant = await Merchant.findById(userId);
    const customer = await Customer.findById(userId);
    await sendNotification(userId, eventName, data);
    if (merchant) {

    } else if (customer) {
      
    } else {
      await AgentNotificationLogs.create({
        orderId: order.id,
        agentId: userId,
        pickupDetail: {
          name: order.orderDetail.pickupAddress.fullName,
          address: order.orderDetail.pickupAddress,
        },
        deliveryDetail: {
          name: deliveryAddress.fullName,
          address: deliveryAddress,
        },
        orderType: order.orderDetail.deliveryMode,
      });
    }
    res.status(200).send({ message: "Notification sent successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  addNotificationSettingController,
  editNotificationSettingController,
  deleteNotificationSettingController,
  getAllNotificationSettingController,
  searchNotificationSettingController,
  getNotificationSettingController,
  addPushNotificationController,
  deletePushNotificationController,
  searchPushNotificationController,
  getAllPushNotificationController,
  fetchPushNotificationController,
  addAlertNotificationController,
  sendNotificationController,
};
