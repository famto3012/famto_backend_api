const appError = require("../../../utils/appError");
const { validationResult } = require("express-validator");
const NotificationSetting = require("../../../models/NotificationSetting");
const PushNotification = require("../../../models/PushNotification");
const { uploadToFirebase, deleteFromFirebase } = require("../../../utils/imageOperation");


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
      email
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
      email
    });

    await newNotificationSetting.save();

    res.status(201).json({
      success: "Notification setting created successfully",
      data: newNotificationSetting
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
      email
    } = req.body;

    const updatedNotificationSetting = await NotificationSetting.findByIdAndUpdate(
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
        email
      },
      { new: true } 
    );

    if (!updatedNotificationSetting) {
      return res.status(404).json({ error: "Notification setting not found" });
    }

    res.status(200).json({
      success: "Notification Setting updated successfully",
      data: updatedNotificationSetting
    });
  } catch (err) {
    next(appError(err.message));
  }
};


const deleteNotificationSettingController = async (req, res, next) => {
  try {
    const deletedNotificationSetting = await NotificationSetting.findByIdAndDelete(req.params.id);

    if (!deletedNotificationSetting) {
      return res.status(404).json({ error: "Notification setting not found" });
    }

    res.status(200).json({
      success: "Notification setting deleted successfully"
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAllNotificationSettingController = async(req,res)=>{
  try{
    const notificationSettings = await NotificationSetting.find();
    res.status(200).json({
      success: "Notification setting found",
      data: notificationSettings
    });
  }catch(err){
    next(appError(err.message));
  }
}

const getNotificationSettingController = async(req,res)=>{
  try{
    const notificationSettingId = req.params.notificationSettingId
    const notificationSettings = await NotificationSetting.findOne({_id: notificationSettingId});
    res.status(200).json({
      success: "Notification setting found",
      data: notificationSettings
    });
  }catch(err){
    next(appError(err.message));
  }
}

const searchNotificationSettingController = async (req, res, next) => {
  try {
    const { query } = req.query;

    const searchTerm = query.trim();

    const searchResults = await NotificationSetting.find({ event: { $regex: searchTerm, $options: "i" } ,});

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

      const {
        title,
        description,
        geofence,
        merchant,
        driver,
        customer
      } = req.body;

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
        customer
      });
  
      const savedPushNotification = await newPushNotification.save();
  
      res.status(201).json({
        success: "Push Notification created successfully",
        data: savedPushNotification
      });
    } catch (err) {
      next(appError(err.message));
    }
  };

  const deletePushNotificationController = async (req, res, next) => {
    try {
      const { id } = req.params;
  
      const deletedPushNotification = await PushNotification.findOne({_id : id});
  
      if (!deletedPushNotification) {
        return res.status(404).json({ error: "Push Notification not found" });
      }else{
        await deleteFromFirebase(deletedPushNotification.imageUrl)
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
  
      const searchResults = await PushNotification.find({ title: { $regex: searchTerm, $options: "i" } ,});
  
      res.status(200).json({
        message: "Searched push notification results",
        data: searchResults,
      });
    } catch (err) {
      next(appError(err.message));
    }
  };

  const getAllPushNotificationController = async(req,res)=>{
    try{
      const pushNotification = await PushNotification.find();
      res.status(200).json({
        success: "Push Notification found",
        data: pushNotification
      });
    }catch(err){
      next(appError(err.message));
    }
  }

  const fetchPushNotificationController = async (req, res, next) => {
    try {
      const { type } = req.query;
  
      if (!['merchant', 'driver', 'customer'].includes(type)) {
        return res.status(400).json({ error: "Invalid type parameter" });
      }
  
      const query = {};
      query[type] = true;
  
      const pushNotifications = await PushNotification.find(query);
  
      res.status(200).json({
        success: "Push Notifications fetched successfully",
        data: pushNotifications
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
   addPushNotificationController,
   deletePushNotificationController,
   searchPushNotificationController,
   getAllPushNotificationController,
   fetchPushNotificationController
   };