const appError = require("../../utils/appError");
const Merchant = require("../../models/Admin");
const generateToken = require("../../utils/generateToken");
const bcrypt = require("bcryptjs");
const MerchantDetail = require("../../models/MerchantDetail");
const Customer = require("../../models/Customer");
const Geofence = require("../../models/Geofence");
const { validationResult } = require("express-validator");
const PushNotification = require("../../models/PushNotifcation");

const registerController = async (req, res, next) => {
  try {
    const { fullName, email, phoneNumber, password } = req.body;
    const merchant = await Merchant.findOne({ email });

    if (merchant) {
      return res.status(400).json({ error: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newMerchant = new Merchant({
      fullName,
      email,
      phoneNumber,
      password: hashedPassword,
    });
    await newMerchant.save();

    if (newMerchant) {
      res.status(201).json({
        success: "User created successfully",
        _id: newMerchant._id,
        fullName: newMerchant.fullName,
        email: newMerchant.email,
        phoneNumber: newMerchant.phoneNumber,
      });
    } else {
      res.status(400).json({ error: "Invalid user data received" });
    }
  } catch (err) {
    next(appError(err.message));
  }
};

const loginController = async (req, res) => {
  try {
    const { email, password } = req.body;

    const merchant = await Merchant.findOne({ email });
    const merchantDetails = await MerchantDetail.findOne({
      merchantId: merchant.id,
    });
    const isPasswordCorrect = await bcrypt.compare(
      password,
      merchant?.password || ""
    );

    if (!merchant || !isPasswordCorrect) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    if (merchant.role === "Admin") {
      res.status(200).json({
        _id: merchant.id,
        fullName: merchant.fullName,
        email: merchant.email,
        token: generateToken(merchant._id, merchant.role),
        role: merchant.role,
      });
    } else {
      if (merchant.isApproved) {
        if (merchantDetails.isBlocked) {
          res.status(400).json({
            message: "Account is Blocked",
          });
        } else {
          res.status(200).json({
            _id: merchant.id,
            fullName: merchant.fullName,
            email: merchant.email,
            token: generateToken(merchant._id, merchant.role),
            role: merchant.role,
          });
        }
      } else {
        res.status(400).json({
          message: "Registration not approved",
        });
      }
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
    console.log("Error in loginUser", err.message);
  }
};

const blockMerchant = async (req, res) => {
  try {
    const merchantId = req.params.merchantId;
    const { reasonForBlocking } = req.body;

    const merchantDetail = await MerchantDetail.findOne({ merchantId });

    if (merchantDetail.isBlocked) {
      merchantDetail.isBlocked = false;
      merchantDetail.reasonForBlockingOrDeleting = null;
      await merchantDetail.save();
      res.status(200).json({
        message: "Merchant Unblocked",
      });
    } else {
      merchantDetail.isBlocked = true;
      merchantDetail.reasonForBlockingOrDeleting = reasonForBlocking;
      await merchantDetail.save();
      res.status(200).json({
        message: "Merchant blocked",
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
    console.log("Error in blockMerchant", err.message);
  }
};

const blockCustomer = async (req, res) => {
  try {
    const customerId = req.params.merchantId;
    const { reasonForBlocking } = req.body;

    const customer = await Customer.findOne({ _id: customerId });
    const customerDetail = customer.customerDetails;

    if (customerDetail.isBlocked) {
      customerDetail.isBlocked = false;
      customerDetail.reasonForBlockingOrDeleting = null;
      await customer.save();
      res.status(200).json({
        message: "Merchant Unblocked",
      });
    } else {
      customerDetail.isBlocked = true;
      customerDetail.reasonForBlockingOrDeleting = reasonForBlocking;
      await customer.save();
      res.status(200).json({
        message: "Merchant blocked",
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
    console.log("Error in blockMerchant", err.message);
  }
};

const addGeofence = async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    let formattedErrors = {};
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(400).json({ errors: formattedErrors });
  }

  try {
    const { name, color, description, coordinates, manager } = req.body;

    // Validate coordinates format
    if (
      !Array.isArray(coordinates) ||
      !coordinates.every((coord) => Array.isArray(coord) && coord.length === 2)
    ) {
      return res.status(400).json({
        error:
          "Invalid coordinates format. Coordinates should be an array of [latitude, longitude] pairs.",
      });
    }

    const newGeofence = new Geofence({
      name,
      color,
      description,
      coordinates,
      manager,
    });

    await newGeofence.save();

    res.status(201).json({
      success: "Geofence added successfully",
      geofence: newGeofence,
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

    const newPushNotification = new PushNotification({
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

    await newPushNotification.save();

    res.status(201).json({
      success: "Push notification created successfully",
      data: newPushNotification,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const editPushNotificationController = async (req, res, next) => {
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

    const updatedPushNotification = await PushNotification.findByIdAndUpdate(
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
      }
    );

    if (!updatedPushNotification) {
      return res.status(404).json({ error: "Push notification not found" });
    }

    res.status(200).json({
      success: "Push notification updated successfully",
      data: updatedPushNotification,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const deletePushNotificationController = async (req, res, next) => {
  try {
    const deletedPushNotification = await PushNotification.findByIdAndDelete(
      req.params.id
    );

    if (!deletedPushNotification) {
      return res.status(404).json({ error: "Push notification not found" });
    }

    res.status(200).json({
      success: "Push notification deleted successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  registerController,
  loginController,
  blockMerchant,
  blockCustomer,
  addGeofence,
  addPushNotificationController,
  editPushNotificationController,
  deletePushNotificationController,
};
