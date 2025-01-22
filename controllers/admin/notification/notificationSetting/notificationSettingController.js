const appError = require("../../../../utils/appError");
const { validationResult } = require("express-validator");
const NotificationSetting = require("../../../../models/NotificationSetting");

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
      title,
      description,
      admin,
      merchant,
      driver,
      customer,
      manager,
      whatsapp,
      sms,
      email,
    } = req.body;

    const notificationFound = await NotificationSetting.findOne({ event });

    if (notificationFound) {
      return res
        .status(400)
        .json({ message: "Notification with this event already exists" });
    }

    const newNotificationSetting = new NotificationSetting({
      event,
      title,
      description,
      admin,
      merchant,
      driver,
      customer,
      manager,
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
      title,
      description,
      admin,
      merchant,
      driver,
      customer,
      manager,
      whatsapp,
      sms,
      email,
    } = req.body;

    const updatedNotificationSetting =
      await NotificationSetting.findByIdAndUpdate(
        req.params.id,
        {
          event,
          title,
          description,
          admin,
          merchant,
          driver,
          customer,
          manager,
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

const editNotificationSettingStatusController = async (req, res, next) => {
  try {
    const updatedNotificationSetting = await NotificationSetting.findById(
      req.params.id
    );

    if (updatedNotificationSetting) {
      // Assuming status is a boolean, toggle it
      updatedNotificationSetting.status = !updatedNotificationSetting.status;

      // Save the updated document
      await updatedNotificationSetting.save();

      res.status(200).json(updatedNotificationSetting);
    } else {
      res.status(404).json({ message: "Notification setting not found" });
    }
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

const getAllNotificationSettingController = async (req, res, next) => {
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

const getNotificationSettingController = async (req, res, next) => {
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

//TODO: Remove when panel v2 is complete
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

module.exports = {
  addNotificationSettingController,
  editNotificationSettingController,
  deleteNotificationSettingController,
  getAllNotificationSettingController,
  searchNotificationSettingController,
  getNotificationSettingController,
  editNotificationSettingStatusController,
};
