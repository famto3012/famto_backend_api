const appError = require("../../../../utils/appError");
const { validationResult } = require("express-validator");
const PushNotification = require("../../../../models/PushNotification");
const {
  uploadToFirebase,
  deleteFromFirebase,
} = require("../../../../utils/imageOperation");

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

module.exports = {
  addPushNotificationController,
  deletePushNotificationController,
  searchPushNotificationController,
  getAllPushNotificationController,
  fetchPushNotificationController,
};
