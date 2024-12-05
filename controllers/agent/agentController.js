const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

const {
  uploadToFirebase,
  deleteFromFirebase,
} = require("../../utils/imageOperation");
const generateToken = require("../../utils/generateToken");
const geoLocation = require("../../utils/getGeoLocation");
const appError = require("../../utils/appError");

const {
  formatToHours,
  updateLoyaltyPoints,
  processReferralRewards,
  calculateAgentEarnings,
  updateOrderDetails,
  updateAgentDetails,
  updateNotificationStatus,
  updateCustomerSubscriptionCount,
} = require("../../utils/agentAppHelpers");
const { formatDate, formatTime } = require("../../utils/formatters");

const Agent = require("../../models/Agent");
const Task = require("../../models/Task");
const LoyaltyPoint = require("../../models/LoyaltyPoint");
const NotificationSetting = require("../../models/NotificationSetting");
const AgentNotificationLogs = require("../../models/AgentNotificationLog");
const AgentAnnouncementLogs = require("../../models/AgentAnnouncementLog");
const Customer = require("../../models/Customer");
const Order = require("../../models/Order");

const {
  getDistanceFromPickupToDelivery,
  getDeliveryAndSurgeCharge,
} = require("../../utils/customerAppHelpers");
const {
  createRazorpayOrderId,
  verifyPayment,
  createRazorpayQrCode,
} = require("../../utils/razorpayPayment");

const {
  sendSocketData,
  sendNotification,
  findRolesToNotify,
} = require("../../socket/socket");
const FcmToken = require("../../models/fcmToken");
const Merchant = require("../../models/Merchant");

// Update location on entering APP
const updateLocationController = async (req, res, next) => {
  try {
    const currentAgentId = req.userAuth;
    const { latitude, longitude } = req.body;

    // Retrieve agent data and geolocation concurrently
    const [agentFound, geofence] = await Promise.all([
      Agent.findById(currentAgentId),
      geoLocation(latitude, longitude),
    ]);

    // Early return if agent is not found
    if (!agentFound) return next(appError("Agent not found", 404));

    // Update agent's location and geofence
    agentFound.location = [latitude, longitude];
    agentFound.geofenceId = geofence.id;

    await agentFound.save();

    res.status(200).json({
      message: "Location and geofence updated successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Agent register Controller
const registerAgentController = async (req, res, next) => {
  const { fullName, email, phoneNumber, latitude, longitude } = req.body;

  // Consolidate validation and return errors if any
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().reduce((acc, error) => {
      acc[error.path] = error.msg;
      return acc;
    }, {});
    return res.status(400).json({ errors: formattedErrors });
  }

  try {
    // Normalize and prepare data
    const normalizedEmail = email.toLowerCase();
    const location = [latitude, longitude];

    // Check if email or phone already exists in a single call
    const [existingAgent, geofence] = await Promise.all([
      Agent.findOne({ $or: [{ email: normalizedEmail }, { phoneNumber }] }),
      geoLocation(latitude, longitude),
    ]);

    // Return early if email or phone already exists
    if (existingAgent) {
      const conflictErrors = {};
      if (existingAgent.email === normalizedEmail) {
        conflictErrors.email = "Email already exists";
      }
      if (existingAgent.phoneNumber === phoneNumber) {
        conflictErrors.phoneNumber = "Phone number already exists";
      }
      return res.status(409).json({ errors: conflictErrors });
    }

    // Handling profile image upload
    const agentImageURL = req.file
      ? await uploadToFirebase(req.file, "AgentImages")
      : "";

    // Create new agent and notification simultaneously
    const newAgent = await Agent.create({
      fullName,
      email: normalizedEmail,
      phoneNumber,
      location,
      geofenceId: geofence._id,
      agentImageURL,
    });

    if (!newAgent) return next(appError("Error in registering new agent"));

    const notification = await NotificationSetting.findOne({
      event: "newAgent",
    });
    const data = {
      title: notification.title,
      description: notification.description,
    };
    const event = "newAgent";
    const role = "Agent";

    // Send notification and socket data
    sendNotification(process.env.ADMIN_ID, event, data, role);
    sendSocketData(process.env.ADMIN_ID, event, data);

    // Send success response
    res.status(200).json({
      message: "Agent registered successfully",
      _id: newAgent._id,
      fullName: newAgent.fullName,
      token: generateToken(newAgent._id, newAgent.role),
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Agent login Controller
const agentLoginController = async (req, res, next) => {
  const { phoneNumber, fcmToken } = req.body;

  // Early validation check and error response
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().reduce((acc, error) => {
      acc[error.path] = error.msg;
      return acc;
    }, {});
    return res.status(400).json({ errors: formattedErrors });
  }

  try {
    // Check if agent exists
    const agentFound = await Agent.findOne({ phoneNumber });
    if (!agentFound) {
      return res.status(404).json({
        errors: { phoneNumber: "Phone number not registered" },
      });
    }

    // Check for approval status
    if (agentFound.isApproved === "Pending" || agentFound.isBlocked) {
      return res.status(403).json({
        errors: { general: "Login is restricted" },
      });
    }

    // Handling FCM token
    await FcmToken.findOneAndUpdate(
      { userId: agentFound._id },
      { token: fcmToken },
      { upsert: true, new: true }
    );

    res.status(200).json({
      message: "Agent Login successful",
      token: generateToken(agentFound._id, agentFound.role),
      _id: agentFound._id,
      fullName: agentFound.fullName,
      agentImageURL: agentFound.agentImageURL,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get agent drawer detail
const getAppDrawerDetailsController = async (req, res, next) => {
  try {
    const agentFound = await Agent.findById(req.userAuth);

    if (!agentFound) return next(appError("Agent not found", 400));

    let status;
    let statusTitle;
    if (agentFound.status === "Free" || agentFound.status === "Busy") {
      statusTitle = "Online";
      status = true;
    } else {
      statusTitle = "Offline";
      status = false;
    }

    const formattedResponse = {
      agentId: req.userAuth,
      agentImageURL: agentFound.agentImageURL,
      agentName: agentFound.fullName,
      status,
      statusTitle,
    };

    res.status(200).json(formattedResponse);
  } catch (err) {
    next(appError(err.message));
  }
};

// Get Agent's profile
const getAgentProfileDetailsController = async (req, res, next) => {
  try {
    // Use lean query with selected fields for efficiency
    const currentAgent = await Agent.findById(req.userAuth)
      .select(
        "fullName phoneNumber email agentImageURL governmentCertificateDetail"
      )
      .lean();

    // Early return if agent is not found
    if (!currentAgent) return next(appError("Agent not found", 404));

    // Send agent profile data in response
    res.status(200).json({ message: "Agent profile data", data: currentAgent });
  } catch (err) {
    next(appError(err.message));
  }
};

// Edit Agent's profile
const editAgentProfileController = async (req, res, next) => {
  const { email, fullName } = req.body;

  // Early validation check
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().reduce((acc, error) => {
      acc[error.path] = error.msg;
      return acc;
    }, {});
    return res.status(400).json({ errors: formattedErrors });
  }

  try {
    const agentToUpdate = await Agent.findById(req.userAuth);
    if (!agentToUpdate) return next(appError("Agent not found", 404));

    // Handle profile image update concurrently
    let agentImageURL = agentToUpdate.agentImageURL;
    if (req.file) {
      const [_, newAgentImageURL] = await Promise.all([
        deleteFromFirebase(agentImageURL),
        uploadToFirebase(req.file, "AgentImages"),
      ]);
      agentImageURL = newAgentImageURL;
    }

    // Update agent profile details
    agentToUpdate.set({ email, fullName, agentImageURL });
    await agentToUpdate.save();

    res.status(200).json({ message: "Agent updated successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

// Delete agent profile
const deleteAgentProfileController = async (req, res, next) => {
  try {
    const agentId = req.userAuth;

    // Find agent document to access image URLs
    const agentFound = await Agent.findById(agentId);
    if (!agentFound) return next(appError("Agent not found", 404));

    // Gather all image URLs to delete
    const imagesToDelete = [
      agentFound.agentImageURL,
      agentFound.governmentCertificateDetail?.aadharFrontImageURL,
      agentFound.governmentCertificateDetail?.aadharBackImageURL,
      agentFound.governmentCertificateDetail?.drivingLicenseFrontImageURL,
      agentFound.governmentCertificateDetail?.drivingLicenseBackImageURL,
      ...agentFound.vehicleDetail.map((vehicle) => vehicle.rcFrontImageURL),
      ...agentFound.vehicleDetail.map((vehicle) => vehicle.rcBackImageURL),
    ].filter(Boolean); // Filter out undefined or null URLs

    // Concurrently delete images
    await Promise.all(imagesToDelete.map((url) => deleteFromFirebase(url)));

    // Delete agent profile after images are deleted
    await Agent.findByIdAndDelete(agentId);

    res.status(200).json({
      message: "Agent profile and associated images deleted successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Update Bank account details controller
const updateAgentBankDetailController = async (req, res, next) => {
  const { accountHolderName, accountNumber, IFSCCode, UPIId } = req.body;

  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const currentAgent = await Agent.findById(req.userAuth);

    if (!currentAgent) return next(appError("Agent not found", 404));

    const bankDetails = {
      accountHolderName,
      accountNumber,
      IFSCCode,
      UPIId,
    };

    currentAgent.bankDetail = bankDetails;

    await currentAgent.save();

    res.status(200).json({
      message: "Agent's bank details added successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get Bank account details controller
const getBankDetailController = async (req, res, next) => {
  try {
    const currentAgent = await Agent.findById(req.userAuth);

    if (!currentAgent) return next(appError("Agent not found", 404));

    // Check if bankDetail exists and set default values if not
    const bankDetails = currentAgent.bankDetail || {
      accountHolderName: "",
      accountNumber: "",
      IFSCCode: "",
      UPIId: "",
    };

    res.status(200).json({
      message: "Bank Details",
      accountHolderName: bankDetails.accountHolderName,
      accountNumber: bankDetails.accountNumber,
      IFSCCode: bankDetails.IFSCCode,
      UPIId: bankDetails.UPIId,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Add agent's vehicle details
const addVehicleDetailsController = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().reduce((acc, error) => {
      acc[error.path] = error.msg;
      return acc;
    }, {});
    return res.status(400).json({ errors: formattedErrors });
  }

  try {
    const agentFound = await Agent.findById(req.userAuth);
    if (!agentFound) return next(appError("Agent not found", 404));

    const { model, type, licensePlate } = req.body;
    const { rcFrontImage, rcBackImage } = req.files;

    // Upload images concurrently
    const [rcFrontImageURL, rcBackImageURL] = await Promise.all([
      uploadToFirebase(rcFrontImage[0], "RCImages"),
      uploadToFirebase(rcBackImage[0], "RCImages"),
    ]);

    // Add vehicle details to agent
    const newVehicle = {
      _id: new mongoose.Types.ObjectId(),
      model,
      type,
      licensePlate,
      rcFrontImageURL,
      rcBackImageURL,
    };
    agentFound.vehicleDetail.push(newVehicle);
    await agentFound.save();

    res.status(200).json({
      message: "Agent's vehicle details added successfully",
      data: newVehicle,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Edit agent's vehicle details
const editAgentVehicleController = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().reduce((acc, error) => {
      acc[error.path] = error.msg;
      return acc;
    }, {});
    return res.status(400).json({ errors: formattedErrors });
  }

  try {
    const currentAgent = await Agent.findById(req.userAuth);
    if (!currentAgent) return next(appError("Agent not found", 404));

    const { vehicleId } = req.params;
    const vehicle = currentAgent.vehicleDetail.id(vehicleId);
    if (!vehicle) return next(appError("Vehicle not found", 404));

    // Parallel image upload handling
    const { rcFrontImage, rcBackImage } = req.files;
    const [newRcFrontImageURL, newRcBackImageURL] = await Promise.all([
      rcFrontImage
        ? uploadToFirebase(rcFrontImage[0], "RCImages")
        : vehicle.rcFrontImageURL,
      rcBackImage
        ? uploadToFirebase(rcBackImage[0], "RCImages")
        : vehicle.rcBackImageURL,
    ]);

    // Update vehicle details
    Object.assign(vehicle, {
      model: req.body.model || vehicle.model,
      type: req.body.type || vehicle.type,
      licensePlate: req.body.licensePlate || vehicle.licensePlate,
      rcFrontImageURL: newRcFrontImageURL,
      rcBackImageURL: newRcBackImageURL,
      vehicleStatus:
        req.body.vehicleStatus !== undefined
          ? req.body.vehicleStatus
          : vehicle.vehicleStatus,
    });

    await currentAgent.save();

    res.status(200).json({
      message: "Vehicle details updated successfully",
      data: vehicle,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get all vehicle details
const getAllVehicleDetailsController = async (req, res, next) => {
  try {
    const currentAgent = await Agent.findById(req.userAuth).select(
      "vehicleDetail"
    );

    if (!currentAgent) return next(appError("Agent not found", 404));

    res.status(200).json({
      message: "Agent vehicle details",
      data: currentAgent,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get single vehicle detail
const getSingleVehicleDetailController = async (req, res, next) => {
  try {
    const currentAgent = await Agent.findById(req.userAuth);

    if (!currentAgent) return next(appError("Agent not found", 404));

    const { vehicleId } = req.params;
    const vehicle = currentAgent.vehicleDetail.id(vehicleId);

    if (!vehicle) return next(appError("Vehicle not found", 404));

    res.status(200).json({
      message: "Vehicle details fetched successfully",
      data: vehicle,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Add agent's government certificates
const addGovernmentCertificatesController = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().reduce((acc, error) => {
      acc[error.path] = error.msg;
      return acc;
    }, {});
    return res.status(400).json({ errors: formattedErrors });
  }

  try {
    const agentFound = await Agent.findById(req.userAuth);
    if (!agentFound) return next(appError("Agent not found", 404));

    const { aadharNumber, drivingLicenseNumber } = req.body;
    const {
      aadharFrontImage,
      aadharBackImage,
      drivingLicenseFrontImage,
      drivingLicenseBackImage,
    } = req.files || {};

    // Concurrently upload images if provided
    const [
      aadharFrontImageURL,
      aadharBackImageURL,
      drivingLicenseFrontImageURL,
      drivingLicenseBackImageURL,
    ] = await Promise.all([
      aadharFrontImage
        ? uploadToFirebase(aadharFrontImage[0], "AadharImages")
        : "",
      aadharBackImage
        ? uploadToFirebase(aadharBackImage[0], "AadharImages")
        : "",
      drivingLicenseFrontImage
        ? uploadToFirebase(drivingLicenseFrontImage[0], "DrivingLicenseImages")
        : "",
      drivingLicenseBackImage
        ? uploadToFirebase(drivingLicenseBackImage[0], "DrivingLicenseImages")
        : "",
    ]);

    // Set government certificate details
    agentFound.governmentCertificateDetail = {
      aadharNumber,
      aadharFrontImageURL,
      aadharBackImageURL,
      drivingLicenseNumber,
      drivingLicenseFrontImageURL,
      drivingLicenseBackImageURL,
    };
    await agentFound.save();

    res.status(200).json({
      message: "Agent government certificates added successfully",
      data: agentFound.governmentCertificateDetail,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Change agent's status to Free
const toggleOnlineController = async (req, res, next) => {
  try {
    const currentAgent = await Agent.findById(req.userAuth);

    if (!currentAgent) return next(appError("Agent not found", 404));

    // Ensure appDetail exists
    if (!currentAgent.appDetail) {
      currentAgent.appDetail = {
        orders: 0,
        pendingOrders: 0,
        totalDistance: 0,
        cancelledOrders: 0,
        loginHours: 0,
      };
    }

    const eventName = "updatedAgentStatusToggle";

    if (currentAgent.status === "Free" || currentAgent.status === "Busy") {
      currentAgent.status = "Inactive";
      const data = {
        status: "Offline",
      };
      const eventName = "updatedAgentStatusToggle";

      sendSocketData(currentAgent._id, eventName, data);

      // Set the end time when the agent goes offline
      currentAgent.loginEndTime = new Date();

      if (currentAgent.loginStartTime) {
        const loginDuration =
          new Date() - new Date(currentAgent.loginStartTime); // in milliseconds
        currentAgent.appDetail.loginDuration += loginDuration;
      }

      currentAgent.loginStartTime = null;
    } else {
      currentAgent.status = "Free";

      const data = {
        status: "Online",
      };

      sendSocketData(currentAgent._id, eventName, data);

      // Set the start time when the agent goes online
      currentAgent.loginStartTime = new Date();
    }

    await currentAgent.save();

    res.status(200).json({
      message: `Agent status changed to ${currentAgent.status}`,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Delete vehicle
const deleteAgentVehicleController = async (req, res, next) => {
  try {
    const agentFound = await Agent.findById(req.userAuth);

    if (!agentFound) return next(appError("Agent not found", 404));

    const { vehicleId } = req.params;

    const vehicleIndex = agentFound.vehicleDetail.findIndex(
      (vehicle) => vehicle._id.toString() === vehicleId
    );

    if (vehicleIndex === -1) return next(appError("Vehicle not found", 404));

    // Remove the vehicle from the array
    agentFound.vehicleDetail.splice(vehicleIndex, 1);

    await agentFound.save();

    res.status(200).json({
      message: "Vehicle detail deleted successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Change status of vehicle
const changeVehicleStatusController = async (req, res, next) => {
  try {
    const agentFound = await Agent.findById(req.userAuth);

    if (!agentFound) return next(appError("Agent not found", 404));

    const { vehicleId } = req.params;

    let vehicleFound = false;

    // Update the status of each vehicle
    agentFound.vehicleDetail.forEach((vehicle) => {
      if (vehicle._id.toString() === vehicleId) {
        vehicle.vehicleStatus = !vehicle.vehicleStatus;
        vehicleFound = true;
      } else {
        vehicle.vehicleStatus = false;
      }
    });

    if (!vehicleFound) return next(appError("Vehicle not found", 404));

    await agentFound.save();

    res.status(200).json({
      message: "Vehicle status updated successfully",
      data: agentFound.vehicleDetail,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Rate customer by order
const rateCustomerController = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { rating, review } = req.body;

    const orderFound = await Order.findById(orderId);

    if (!orderFound) return next(appError("Order not found", 404));

    const customerFound = await Customer.findById(orderFound.customerId);

    if (!customerFound) return next(appError("Customer not found", 404));

    orderFound.orderRating.ratingByDeliveryAgent.review = review;
    orderFound.orderRating.ratingByDeliveryAgent.rating = rating;

    let updatedCustomerRating = {
      agentId: req.userAuth,
      review,
      rating,
    };

    customerFound.ratingsByAgents.push(updatedCustomerRating);

    await Promise.all([orderFound.save(), customerFound.save()]);

    res.status(200).json({ message: "Customer rated successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get agent's current day statistics
const getCurrentDayAppDetailController = async (req, res, next) => {
  try {
    const agentId = req.userAuth;

    const agentFound = await Agent.findById(agentId)
      .select("appDetail ratingsByCustomers")
      .lean({ virtuals: true })
      .exec();

    if (!agentFound) return next(appError("Agent not found", 404));

    const formattedResponse = {
      totalEarning: agentFound?.appDetail?.totalEarning || 0,
      orders: agentFound?.appDetail?.orders || 0,
      pendingOrders: agentFound?.appDetail?.pendingOrders || 0,
      totalDistance: agentFound?.appDetail?.totalDistance || 0.0,
      averageRating: agentFound.averageRating || 0.0,
    };

    res.status(200).json({
      message: "Current day statistic of agent",
      data: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get agent's history of app details
const getHistoryOfAppDetailsController = async (req, res, next) => {
  try {
    const agentId = req.userAuth;

    const agentFound = await Agent.findById(agentId)
      .lean({ virtuals: true })
      .exec();

    if (!agentFound) return next(appError("Agent not found", 404));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayExists = agentFound.appDetailHistory.some(
      (entry) => new Date(entry.date).toDateString() === today.toDateString()
    );

    if (!todayExists) {
      agentFound.appDetailHistory.push({
        date: today,
        details: {
          ...agentFound.appDetail,
          orderDetail: agentFound.appDetail.orderDetail,
        },
      });
    }

    // Sort the appDetailHistory by date in descending order (latest date first)
    const sortedAppDetailHistory = agentFound?.appDetailHistory?.sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    const formattedResponse = sortedAppDetailHistory.map((history) => ({
      date: formatDate(history.date),
      details: {
        totalEarnings: (history.details.totalEarning || 0).toFixed(2),
        orders: history.details.orders || 0,
        cancelledOrders: history.details.cancelledOrders || 0,
        totalDistance: `${(history.details.totalDistance || 0).toFixed(2)} km`,
        loginHours: formatToHours(history.details.loginDuration) || "0:00 hr",
        orderDetail:
          history.details.orderDetail.map((order) => ({
            orderId: order.orderId,
            deliveryMode: order.deliveryMode,
            customerName: order.customerName,
            grandTotal: order.grandTotal,
            date: formatDate(order.completedOn),
            time: formatTime(order.completedOn),
          })) || [],
      },
    }));

    res.status(200).json({
      message: "App Detail history",
      data: formattedResponse || [],
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get ratings of agent
const getRatingsOfAgentController = async (req, res, next) => {
  try {
    const agentId = req.userAuth;

    const agentFound = await Agent.findById(agentId)
      .populate({
        path: "ratingsByCustomers.customerId",
        select: "fullName _id",
      })
      .select("ratingsByCustomers averageRating");

    if (!agentFound) return next(appError("Agent not found", 404));

    const ratingsOfAgent = agentFound.ratingsByCustomers.reverse();

    const formattedRatingAndReviews = ratingsOfAgent.map((rating) => ({
      review: rating?.review,
      rating: rating?.rating,
      customerId: {
        id: rating?.customerId?._id,
        fullName: rating?.customerId?.fullName || "-",
      },
    }));

    res.status(200).json({
      message: "Ratings of agent",
      averageRating: agentFound.averageRating.toFixed(1) || "0.0",
      data: formattedRatingAndReviews,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get task previews
const getTaskPreviewController = async (req, res, next) => {
  try {
    const agentId = req.userAuth;

    const agentFound = await Agent.findById(agentId);

    if (!agentFound) return next(appError("Agent not found", 404));

    const taskFound = await Task.find({
      agentId,
      taskStatus: "Assigned",
    })
      .populate("orderId")
      .sort({ createdAt: 1 });

    let currentTasks = [];
    let nextTasks = [];

    const groupedTasks = {};

    taskFound.forEach((task) => {
      const orderId = task.orderId?._id;

      // Initialize grouped task for the order if it doesn't exist
      if (!groupedTasks[orderId]) {
        groupedTasks[orderId] = {
          orderId: orderId,
          orderType: task?.orderId?.orderDetail?.deliveryMode || null,
          tasks: {
            pickup: null,
            delivery: null,
          },
        };
      }

      // Construct pickup task
      const pickupTask = {
        type: "Pickup",
        taskId: task._id,
        taskStatus: task.pickupDetail.pickupStatus,
        date: formatDate(task.orderId?.orderDetail?.deliveryTime),
        time: formatTime(task.createdAt),
        address: {
          fullName: task?.pickupDetail?.pickupAddress?.fullName || null,
          flat: task?.pickupDetail?.pickupAddress?.flat || null,
          area: task?.pickupDetail?.pickupAddress?.area || null,
          phoneNumber: task?.pickupDetail?.pickupAddress?.phoneNumber || null,
          location: task?.pickupDetail?.pickupLocation || null,
        },
        agentLocation: agentFound.location,
      };

      // Construct delivery task
      const deliveryTask = {
        type: "Delivery",
        taskId: task._id,
        taskStatus: task.deliveryDetail.deliveryStatus,
        date: formatDate(task.createdAt),
        time: formatTime(task.orderId.orderDetail.deliveryTime),
        name: task.deliveryDetail.deliveryAddress.fullName,
        address: {
          fullName: task.deliveryDetail.deliveryAddress.fullName,
          flat: task?.deliveryDetail?.deliveryAddress?.flat,
          area: task.deliveryDetail.deliveryAddress.area,
          phoneNumber: task.deliveryDetail.deliveryAddress.phoneNumber,
          location: task.deliveryDetail.deliveryLocation,
        },
        agentLocation: agentFound.location,
      };

      // Add tasks to grouped object based on type
      groupedTasks[orderId].tasks.pickup = pickupTask;
      groupedTasks[orderId].tasks.delivery = deliveryTask;
    });

    // Separate tasks into currentTasks and nextTasks
    Object.values(groupedTasks).forEach((order) => {
      // const { pickup, delivery } = order.tasks;
      // Check if either task has "Started" status and add both to currentTasks
      // if (
      //   pickup.taskStatus === "Started" ||
      //   delivery.taskStatus === "Started"
      // ) {
      currentTasks.push(order);
      // }
      // // Check if both tasks are "Accepted" status and add both to nextTasks
      // else if (
      //   pickup.taskStatus === "Accepted" &&
      //   delivery.taskStatus === "Accepted"
      // ) {
      //   nextTasks.push(order);
      // }
    });

    // console.log(currentTasks);
    // console.log(nextTasks);

    res.status(200).json({
      message: "Task preview",
      data: {
        currentTasks,
        nextTasks,
      },
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get pickup details
const getPickUpDetailController = async (req, res, next) => {
  try {
    const { taskId } = req.params;

    const taskFound = await Task.findById(taskId).populate("orderId");
    if (!taskFound) {
      return next(appError("Task not found", 404));
    }

    let merchantFound;
    if (taskFound?.orderId?.merchantId) {
      merchantFound = await Merchant.findById(taskFound.orderId.merchantId); // Update here if needed
    }

    const formattedResponse = {
      taskId: taskFound._id,
      orderId: taskFound.orderId._id,
      merchantId: merchantFound?._id || null,
      merchantName: merchantFound?.merchantDetail?.merchantName || null,
      customerId: taskFound?.orderId?.customerId || null,
      customerName:
        taskFound?.orderId?.orderDetail?.deliveryAddress?.fullName || null,
      customerPhoneNumber:
        taskFound?.orderId?.orderDetail?.deliveryAddress?.phoneNumber || null,
      type: "Pickup",
      date: formatDate(taskFound?.orderId?.createdAt) || null,
      time: formatTime(taskFound?.orderId?.createdAt) || null,
      taskStatus: taskFound.pickupDetail?.pickupStatus || null,
      pickupName: taskFound?.pickupDetail?.pickupAddress?.fullName || null,
      pickupAddress: taskFound?.pickupDetail?.pickupAddress?.area || null,
      pickupPhoneNumber:
        taskFound?.pickupDetail?.pickupAddress?.phoneNumber || null,
      instructions:
        taskFound?.orderId?.orderDetail?.instructionToMerchant ||
        taskFound?.orderId?.orderDetail?.instructionInPickup ||
        null,
      voiceInstructions:
        taskFound?.orderId?.orderDetail?.voiceInstructionToMerchant ||
        taskFound?.orderId?.orderDetail?.voiceInstructionInPickup ||
        taskFound?.orderId?.orderDetail?.voiceInstructionToDeliveryAgent ||
        null,
      pickupLocation: taskFound?.pickupDetail?.pickupLocation,
      deliveryMode: taskFound?.orderId?.orderDetail?.deliveryMode || null,
      orderItems: taskFound?.orderId?.items || [],
      billDetail: taskFound?.orderId?.billDetail || {},
      paymentMode: taskFound?.orderId?.paymentMode || null,
      paymentStatus: taskFound?.orderId?.paymentStatus || null,
    };

    res.status(200).json({
      message: "Pick up details.",
      data: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get delivery details
const getDeliveryDetailController = async (req, res, next) => {
  try {
    const { taskId } = req.params;

    const taskFound = await Task.findById(taskId).populate("orderId");

    const formattedResponse = {
      taskId: taskFound._id,
      orderId: taskFound.orderId._id,
      messageReceiverId: taskFound?.orderId?.customerId || null,
      type: "Delivery",
      date: formatDate(taskFound.orderId.orderDetail?.deliveryTime),
      time: formatTime(taskFound.orderId.orderDetail?.deliveryTime),
      taskStatus: taskFound.deliveryDetail?.deliveryStatus,
      customerName: taskFound?.deliveryDetail?.deliveryAddress?.fullName,
      deliveryAddress: taskFound?.deliveryDetail?.deliveryAddress,
      customerPhoneNumber:
        taskFound?.deliveryDetail?.deliveryAddress?.phoneNumber,
      instructions:
        taskFound?.orderId?.orderDetail?.instructionInDelivery ||
        taskFound?.orderId?.orderDetail?.instructionToDeliveryAgent ||
        null,
      voiceInstructions:
        taskFound?.orderId?.orderDetail?.voiceInstructionInDelivery ||
        taskFound?.orderId?.orderDetail?.voiceInstructionToDeliveryAgent ||
        null,
      deliveryLocation: taskFound?.deliveryDetail?.deliveryLocation,
      deliveryMode: taskFound.orderId.orderDetail.deliveryMode,
      orderItems: taskFound.orderId.items,
      billDetail: taskFound.orderId.billDetail,
      paymentMode: taskFound.orderId.paymentMode,
      paymentStatus: taskFound.orderId.paymentStatus,
      isnoteAdded: taskFound?.orderId?.detailAddedByAgent?.notes ? true : false,
      isSignatureAdded: taskFound?.orderId?.detailAddedByAgent
        ?.signatureImageURL
        ? true
        : false,
      isImageAdded: taskFound?.orderId?.detailAddedByAgent?.imageURL
        ? true
        : false,
    };

    res.status(200).json({
      message: "Delivery details",
      data: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Add item price in Custom order
const addCustomOrderItemPriceController = async (req, res, next) => {
  try {
    const { orderId, itemId } = req.params;
    const { price } = req.body;
    const agentId = req.userAuth;

    // Validate price input
    const newPrice = parseFloat(price);
    if (isNaN(newPrice) || newPrice <= 0) {
      return next(
        appError("Invalid price. It must be a positive number.", 400)
      );
    }

    const orderFound = await Order.findById(orderId);
    if (!orderFound) return next(appError("Order not found", 404));

    if (orderFound.agentId.toString() !== agentId.toString()) {
      return next(appError("Agent access denied", 403));
    }

    const itemFound = orderFound.items.find(
      (item) => item.itemId.toString() === itemId.toString()
    );
    if (!itemFound) return next(appError("Item not found in order", 404));

    // Check if the new price is equal to the existing price
    const existingPrice = itemFound.price || 0;
    if (existingPrice === newPrice) {
      return res.status(200).json({
        message:
          "No changes made. The new price is the same as the existing price.",
        data: existingPrice,
      });
    }

    // Update the item's price
    itemFound.price = newPrice;

    // Adjust totals by subtracting the existing price and adding the new price
    const updatedItemTotal =
      orderFound.billDetail.itemTotal - existingPrice + newPrice;

    const deliveryCharge = orderFound.billDetail.deliveryCharge || 0;
    const surgePrice = orderFound.billDetail.surgePrice || 0;

    const updatedSubTotal = updatedItemTotal + deliveryCharge + surgePrice;

    // Grand total is recalculated based on adjusted totals
    const updatedGrandTotal = updatedSubTotal;

    // Update the order's billing details
    orderFound.billDetail.itemTotal = parseFloat(updatedItemTotal.toFixed(2));
    orderFound.billDetail.subTotal = parseFloat(updatedSubTotal.toFixed(2));
    orderFound.billDetail.grandTotal = parseFloat(updatedGrandTotal.toFixed(2));

    await orderFound.save();

    res.status(200).json({
      message: "Item price updated successfully",
      data: newPrice,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Add details by agent
const addOrderDetailsController = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { notes } = req.body;

    const [orderFound, agentFound] = await Promise.all([
      Order.findById(orderId),
      Agent.findById(req.userAuth),
    ]);

    if (!orderFound) return next(appError("Order not found", 404));
    if (!agentFound) return next(appError("Agent not found", 404));

    const [signatureImageURL, imageURL] = await Promise.all([
      req.files?.signatureImage
        ? uploadToFirebase(req.files.signatureImage[0], "OrderDetailImages")
        : "",
      req.files?.image
        ? uploadToFirebase(req.files.image[0], "OrderDetailImages")
        : "",
    ]);

    // Set updated order details
    orderFound.detailAddedByAgent = {
      ...(orderFound.detailAddedByAgent || {}),
      notes,
      signatureImageURL,
      imageURL,
    };

    await orderFound.save();

    const stepperDetail = {
      by: agentFound.fullName,
      userId: agentFound._id,
      date: new Date(),
      detailURL: notes || signatureImageURL || imageURL,
    };

    // Send notification to Customer and Admin
    const data = {
      orderDetailStepper: stepperDetail,
    };

    const parameters = {
      eventName: "agentOrderDetailUpdated",
      user: "Customer",
      role: "Admin",
    };

    sendSocketData(
      orderFound.customerId,
      parameters.eventName,
      data,
      parameters.user
    );

    sendSocketData(
      process.env.ADMIN_ID,
      parameters.eventName,
      data,
      parameters.role
    );

    res.status(200).json({
      message: "Order details updated successfully",
      order: orderFound.detailAddedByAgent,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get checkout details
const getCheckoutDetailController = async (req, res, next) => {
  try {
    const { taskId } = req.params;

    const taskFound = await Task.findOne({
      _id: taskId,
      agentId: req.userAuth,
    }).populate("orderId");

    if (!taskFound) {
      return next(appError("Task not found", 404));
    }

    const formattedData = {
      orderId: taskFound.orderId,
      distance: taskFound.orderId.orderDetail.distance,
      timeTaken: taskFound?.orderId?.orderDetail?.timeTaken
        ? formatToHours(taskFound.orderId.orderDetail.timeTaken)
        : "0 h 0 min",
      delayedBy: taskFound?.orderId?.orderDetail?.delayedBy
        ? formatToHours(taskFound.orderId.orderDetail.delayedBy)
        : "0 h 0 min",
      paymentType: taskFound.orderId.paymentMode,
      paymentStatus: taskFound.orderId.paymentStatus,
      grandTotal: taskFound?.orderId?.billDetail?.grandTotal,
    };

    res.status(200).json({
      message: "Checkout detail",
      data: formattedData,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Confirm money received in cash on delivery
const confirmCashReceivedController = async (req, res, next) => {
  try {
    const { amount, orderId } = req.body;
    const agentId = req.userAuth;
    if (!amount && isNaN(amount))
      return next(appError("Amount must be a number"));

    const [agent, order] = await Promise.all([
      Agent.findById(agentId),
      Order.findById(orderId),
    ]);

    if (!agent) return next(appError("Agent not found", 404));
    if (!order) return next(appError("Order not found", 404));
    if (amount < order.billDetail.grandTotal)
      return next(appError("Enter the correct bill amount"));

    agent.workStructure.cashInHand += parseInt(amount);

    await agent.save();

    res.status(200).json({ message: "Order completed successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

// Complete order after confirming the cash
const completeOrderController = async (req, res, next) => {
  try {
    const { orderId } = req.body;
    const agentId = req.userAuth;

    const [agentFound, orderFound] = await Promise.all([
      Agent.findById(agentId),
      Order.findById(orderId),
    ]);

    if (!agentFound) return next(appError("Agent not found", 404));
    if (!orderFound) return next(appError("Order not found", 404));

    if (orderFound.status === "Completed")
      return next(appError("Order already completed", 400));

    const customerFound = await Customer.findById(orderFound.customerId);

    if (!customerFound) return next(appError("Customer not found", 404));

    const { itemTotal } = orderFound.billDetail;

    // Calculate loyalty points for customer
    const loyaltyPointCriteria = await LoyaltyPoint.findOne({ status: true });
    if (
      loyaltyPointCriteria &&
      itemTotal >= loyaltyPointCriteria.minOrderAmountForEarning
    ) {
      updateLoyaltyPoints(customerFound, loyaltyPointCriteria, cartTotal);
    }

    // Calculate referral rewards for customer
    if (!customerFound?.referralDetail?.processed) {
      await processReferralRewards(customerFound, itemTotal);
    }

    // Calculate earnings for agent
    const calculatedSalary = await calculateAgentEarnings(
      agentFound,
      orderFound
    );

    // Update order details
    updateOrderDetails(orderFound, calculatedSalary);

    const isOrderCompleted = true;

    await Promise.all([
      updateCustomerSubscriptionCount(customerFound._id),
      updateNotificationStatus(orderId),
      updateAgentDetails(
        agentFound,
        orderFound,
        calculatedSalary,
        isOrderCompleted
      ),
    ]);

    const stepperDetail = {
      by: agentFound.fullName,
      date: new Date(),
    };

    orderFound.orderDetailStepper.completed = stepperDetail;

    await Promise.all([
      orderFound.save(),
      customerFound.save(),
      agentFound.save(),
      Agent.findByIdAndUpdate(agentId, {
        $inc: { taskCompleted: 1, "appDetail.orders": 1 },
      }),
    ]);

    const eventName = "orderCompleted";

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
            orderId: orderFound._id,
            customerId: customerFound._id,
            merchantId: orderFound?.merchantId,
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
      orderDetailStepper: stepperDetail,
    };

    sendSocketData(process.env.ADMIN_ID, eventName, socketData);
    sendSocketData(orderFound.customerId, eventName, socketData);
    if (orderFound?.merchantId) {
      sendSocketData(orderFound.merchantId, eventName, socketData);
    }

    res.status(200).json({
      message: "Order completed successfully",
      data: calculatedSalary,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Add ratings to customer by the order
const addRatingsToCustomer = async (req, res, next) => {
  try {
    const { review, rating } = req.body;
    const { orderId } = req.params;
    const agentId = req.userAuth;

    const orderFound = await Order.findById(orderId);

    if (!orderFound) return next(appError("Order not found", 404));

    const customerFound = await Customer.findById(orderFound.customerId);

    if (!customerFound) return next(appError("Customer not found", 404));

    let updatedOrderRating = {
      review,
      rating,
    };

    // Initialize orderRating if it doesn't exist
    if (!orderFound.orderRating) {
      orderFound.orderRating = {};
    }

    orderFound.orderRating.ratingByDeliveryAgent = updatedOrderRating;

    let ratingsByAgent = {
      agentId,
      review,
      rating,
    };

    customerFound.customerDetails.ratingsByAgents.push(ratingsByAgent);

    await Promise.all([orderFound.save(), customerFound.save()]);

    res.status(200).json({ message: "Customer rated successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get cash in hand value
const getCashInHandController = async (req, res, next) => {
  try {
    const agentId = req.userAuth;

    const agentFound = await Agent.findById(agentId);

    if (!agentFound) {
      return next(appError("agent not found", 404));
    }

    const cashInHand = agentFound.workStructure.cashInHand;

    res.status(200).json({ message: "Cash in hand", data: cashInHand });
  } catch (err) {
    next(appError(err.message));
  }
};

// Initiate deposit by razorpay
const depositCashToFamtoController = async (req, res, next) => {
  try {
    const { amount } = req.body;

    const { success, orderId, error } = await createRazorpayOrderId(amount);

    if (!success) {
      return next(appError(`Error in creating Razorpay order: ${error}`, 500));
    }

    res.status(200).json({ success: true, orderId, amount });
  } catch (err) {
    next(appError(err.message));
  }
};

// Verify deposit by razorpay
const verifyDepositController = async (req, res, next) => {
  try {
    const { paymentDetails, amount } = req.body;
    const agentId = req.userAuth;

    const agentFound = await Agent.findById(agentId);

    if (!agentFound) {
      return next(appError("agent not found", 404));
    }

    const isPaymentValid = await verifyPayment(paymentDetails);
    if (!isPaymentValid) {
      return next(appError("Invalid payment", 400));
    }

    let updatedAgentTransaction = {
      type: "Debit",
      amount,
      madeOn: new Date(),
    };

    agentFound.workStructure.cashInHand -= amount;
    agentFound.agentTransaction.push(updatedAgentTransaction);

    await agentFound.save();

    res.status(200).json({ message: "Deposit verified successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get transaction history of agents
const getAgentTransactionsController = async (req, res, next) => {
  try {
    const agentId = req.userAuth;

    const agentFound = await Agent.findById(agentId)
      .select("agentTransaction agentImageURL fullName")
      .lean();

    if (!agentFound) return next(appError("Agent not found", 404));

    // Sort and format transactions
    const formattedTransactions = agentFound.agentTransaction
      .sort((a, b) => new Date(b.madeOn) - new Date(a.madeOn))
      .map((transaction) => ({
        date: formatDate(transaction.madeOn),
        time: formatTime(transaction.madeOn),
        amount: transaction?.amount || null,
        type: transaction?.type || null,
        title: transaction?.title || null,
      }));

    res.status(200).json({
      message: "Agent transaction history",
      data: formattedTransactions,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get earing og agents for the last 7 days
const getAgentEarningsLast7DaysController = async (req, res, next) => {
  try {
    const agentId = req.userAuth;

    const agent = await Agent.findById(agentId);

    if (!agent) {
      return next(appError("Agent not found", 404));
    }

    // Get the current date and the date 7 days ago
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    // Filter the appDetailHistory for the last 7 days
    const earningsLast7Days = agent.appDetailHistory
      .filter((entry) => entry.date >= sevenDaysAgo && entry.date <= today)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map((entry) => ({
        date: formatDate(entry.date),
        totalEarning: entry.details.totalEarning,
      }));

    res.status(200).json({
      message: "Earnings for the last 7 days",
      data: earningsLast7Days || [],
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Update shops by agent in custom Order
const updateCustomOrderStatusController = async (req, res, next) => {
  try {
    const { latitude, longitude, status, description } = req.body;
    const { orderId } = req.params;
    const agentId = req.userAuth;

    const orderFound = await Order.findOne({
      _id: orderId,
      "orderDetail.deliveryMode": "Custom Order",
    });

    if (!orderFound) return next(appError("Order not found", 404));

    if (orderFound.agentId !== agentId)
      return next(appError("Agent access denied (Different agent)"));

    const location = [latitude, longitude];

    // Determine last location and calculate distance
    const shopUpdates = orderFound.detailAddedByAgent?.shopUpdates || [];
    const lastLocation =
      shopUpdates.length > 0
        ? shopUpdates[shopUpdates.length - 1]?.location
        : null;

    const { distanceInKM } = await getDistanceFromPickupToDelivery(
      lastLocation,
      location
    );

    // Update order details
    const newDistance = distanceInKM || 0;
    orderFound.orderDetail.distance =
      (orderFound.orderDetail?.distance || 0) + newDistance;

    // Initialize pickup location if not set
    if (!orderFound.orderDetail.pickupLocation && shopUpdates.length === 0) {
      orderFound.orderDetail.pickupLocation = location;
    }

    // Add shop update
    const updatedData = { location, status, description };
    orderFound.detailAddedByAgent.shopUpdates.push(updatedData);

    await orderFound.save();

    res.status(200).json({
      message: "Shop updated successfully in custom order",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get agent earning for the delivery
const getCompleteOrderMessageController = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const orderFound = await Order.findById(orderId);

    res.status(200).json({
      message: "Order amount",
      data: orderFound?.detailAddedByAgent?.agentEarning || 0,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Generate QR Code for customer payment
const generateRazorpayQRController = async (req, res, next) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return next(appError("Order ID is required", 400));
    }

    const orderFound = await Order.findById(orderId);

    if (!orderFound) {
      return next(appError("Order not found", 404));
    }

    const amount = orderFound.billDetail.grandTotal;

    const qrCode = await createRazorpayQrCode(amount);

    res.status(200).json({ message: "QR code", data: qrCode });
  } catch (err) {
    console.error("Error generating QR code:", JSON.stringify(err, null, 2));
    next(appError(err.message || "An error occurred", 500));
  }
};

// Verify QR Code payment
const verifyQrPaymentController = async (req, res, next) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return next(appError("Order ID is required", 400));
    }

    const orderFound = await Order.findById(orderId);

    if (!orderFound) {
      return next(appError("Order not found", 404));
    }

    if (orderFound.paymentStatus === "Completed") {
      return res.status(200).json({ message: "Payment already processed" });
    }

    const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

    const receivedSignature = req.headers["x-razorpay-signature"];

    const generatedSignature = crypto
      .createHmac("sha256", WEBHOOK_SECRET)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (receivedSignature === generatedSignature) {
      console.log("Webhook verified successfully");

      const paymentData = req.body.payload.payment.entity;

      orderFound.paymentStatus = "Completed";
      orderFound.paymentId = paymentData.id;

      await orderFound.save();

      return res.status(200).json({ message: "QR Code payment verified" });
    } else {
      console.log("Webhook verification failed for order:", orderId);
      return res.status(400).json({
        message: "QR Code payment verification  failed",
      });
    }
  } catch (err) {
    next(appError(err.message));
  }
};

// Check payment status of an order
const checkPaymentStatusOfOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const orderFound = await Order.findById(orderId);

    if (!orderFound) {
      return next(appError("Order not found", 400));
    }

    if (orderFound?.paymentStatus === "Completed") {
      return res.status(200).json({ message: "Payment completed" });
    }

    res.status(400).json({ message: "Payment is not completed yet" });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get all notifications for agent
const getAllNotificationsController = async (req, res, next) => {
  try {
    const agentId = req.userAuth;

    // Set start and end of the day correctly
    const startOfDay = new Date();
    startOfDay.setDate(startOfDay.getDate() - 1);
    startOfDay.setUTCHours(18, 30, 0, 0);
    const endOfDay = new Date();
    endOfDay.setUTCHours(18, 29, 59, 999);

    // Retrieve notifications within the day for the given agent, sorted by date
    const notifications = await AgentNotificationLogs.find({
      agentId,
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    })
      .populate("orderId", "orderDetail")
      .sort({ createdAt: -1 })
      .lean();

    // Format response
    const formattedResponse = notifications.map((notification) => ({
      notificationId: notification._id || null,
      orderId: notification.orderId._id || null,
      pickupDetail: notification.pickupDetail?.address || null,
      deliveryDetail: notification.deliveryDetail?.address || null,
      orderType: notification.orderType || null,
      status: notification.status || null,
      taskDate: formatDate(notification.orderId.orderDetail.deliveryTime),
      taskTime: formatTime(notification.orderId.orderDetail.deliveryTime),
    }));

    res.status(200).json({
      message: "All notification logs",
      data: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get all announcements for agent
const getAllAnnouncementsController = async (req, res, next) => {
  try {
    const agentId = req.userAuth;

    const getAllAnnouncements = await AgentAnnouncementLogs.find({
      agentId,
    }).sort({
      createdAt: -1,
    });

    const formattedResponse = getAllAnnouncements?.map((announcement) => {
      const createdAt = new Date(announcement?.createdAt);
      const currentTime = new Date();
      const timeDifference = Math.abs(currentTime - createdAt);

      // Convert the time difference to a readable format (e.g., in minutes, hours, days)
      const minutes = Math.floor(timeDifference / (1000 * 60));
      const hours = Math.floor(timeDifference / (1000 * 60 * 60));
      const days = Math.floor(timeDifference / (1000 * 60 * 60 * 24));

      let timeString;
      if (days > 0) {
        timeString = `${days} day${days > 1 ? "s" : ""} ago`;
      } else if (hours > 0) {
        timeString = `${hours} hour${hours > 1 ? "s" : ""} ago`;
      } else if (minutes > 0) {
        timeString = `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
      } else {
        timeString = `just now`;
      }

      return {
        announcementId: announcement._id || null,
        imageUrl: announcement?.imageUrl || null,
        title: announcement?.title || null,
        description: announcement?.description || null,
        time: timeString,
      };
    });

    res.status(200).json({
      message: "All announcements logs",
      data: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get pocket balance (un-settled balance)
const getPocketBalanceForAgent = async (req, res, next) => {
  try {
    // Find the agent by ID
    const agent = await Agent.findById(req.userAuth);

    // Check if the agent exists
    if (!agent) return next(appError("Agent not found", 404));

    // Calculate total earnings where paymentSettled is false
    let totalEarnings = 0;

    const unsettledEarnings = agent.appDetailHistory.filter(
      (detail) => detail.details.paymentSettled === false
    );

    unsettledEarnings.forEach((detail) => {
      totalEarnings += detail.details.totalEarning || 0;
    });

    return res.status(200).json({
      success: true,
      totalEarnings,
    });
  } catch (error) {
    next(appError(err.message));
  }
};

module.exports = {
  updateLocationController,
  registerAgentController,
  agentLoginController,
  deleteAgentProfileController,
  getAppDrawerDetailsController,
  getAgentProfileDetailsController,
  editAgentProfileController,
  updateAgentBankDetailController,
  getBankDetailController,
  addVehicleDetailsController,
  addGovernmentCertificatesController,
  toggleOnlineController,
  getAllVehicleDetailsController,
  getSingleVehicleDetailController,
  editAgentVehicleController,
  deleteAgentVehicleController,
  changeVehicleStatusController,
  rateCustomerController,
  getCurrentDayAppDetailController,
  getHistoryOfAppDetailsController,
  getRatingsOfAgentController,
  getTaskPreviewController,
  getPickUpDetailController,
  getDeliveryDetailController,
  addCustomOrderItemPriceController,
  addOrderDetailsController,
  confirmCashReceivedController,
  completeOrderController,
  addRatingsToCustomer,
  getCashInHandController,
  depositCashToFamtoController,
  verifyDepositController,
  getAgentTransactionsController,
  getAgentEarningsLast7DaysController,
  updateCustomOrderStatusController,
  getCheckoutDetailController,
  getCompleteOrderMessageController,
  generateRazorpayQRController,
  verifyQrPaymentController,
  checkPaymentStatusOfOrder,
  getAllNotificationsController,
  getAllAnnouncementsController,
  getPocketBalanceForAgent,
};
