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
const Geofence = require("../../models/Geofence");
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

//Function for getting agent's manager from geofence
const getManager = async (geofenceId) => {
  const geofenceFound = await Geofence.findOne({
    _id: geofenceId,
  });

  const geofenceManager = geofenceFound.orderManager;

  return geofenceManager;
};

// Update location on entering APP
const updateLocationController = async (req, res, next) => {
  try {
    const currentAgent = req.userAuth;
    const { latitude, longitude } = req.body;

    const agentFound = await Agent.findById(currentAgent);

    if (!agentFound) {
      return next(appError("Agent not found", 404));
    }

    const location = [latitude, longitude];

    const geofence = await geoLocation(latitude, longitude);

    agentFound.location = location;
    agentFound.geofenceId = geofence.id;

    await agentFound.save();

    res.status(200).json({
      message: "Location and geofence updated successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

//Agent register Controller
const registerAgentController = async (req, res, next) => {
  const { fullName, email, phoneNumber, latitude, longitude } = req.body;
  const location = [latitude, longitude];

  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const normalizedEmail = email.toLowerCase();
    const emailFound = await Agent.findOne({ email: normalizedEmail });

    const phoneNumberFound = await Agent.findOne({ phoneNumber });

    if (emailFound) {
      formattedErrors.email = "Email already exists";
      return res.status(409).json({ errors: formattedErrors });
    }

    if (phoneNumberFound) {
      formattedErrors.phoneNumber = "Phone number already exists";
      return res.status(409).json({ errors: formattedErrors });
    }

    const geofence = await geoLocation(latitude, longitude);

    const manager = await getManager(geofence.id);

    let agentImageURL = "";

    if (req.file) {
      agentImageURL = await uploadToFirebase(req.file, "AgentImages");
    }

    const newAgent = await Agent.create({
      fullName,
      email,
      phoneNumber,
      location,
      geofenceId: geofence._id,
      agentImageURL,
      manager,
    });

    if (!newAgent) {
      return next(appError("Error in registering new agent"));
    }

    const notification = await NotificationSetting.findOne({
      event: "newAgent",
    });

    const event = "newAgent";
    const role = "Agent";

    const data = {
      title: notification.title,
      description: notification.description,
    };

    sendNotification(process.env.ADMIN_ID, event, data, role);
    sendSocketData(process.env.ADMIN_ID, event, data);

    res.status(200).json({
      message: "Agent registering successfully",
      _id: newAgent._id,
      fullName: newAgent.fullName,
      token: generateToken(newAgent._id, newAgent.role),
    });
  } catch (err) {
    next(appError(err.message));
  }
};

//Agent login Controller
const agentLoginController = async (req, res, next) => {
  const { phoneNumber, fcmToken } = req.body;

  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const agentFound = await Agent.findOne({ phoneNumber });

    if (!agentFound) {
      formattedErrors.phoneNumber = "Phone number not registered";
      return res.status(409).json({ errors: formattedErrors });
    }

    if (agentFound.isApproved === "Pending" || agentFound.isBlocked) {
      formattedErrors.general = "Login is restricted";
      return res.status(403).json({ errors: formattedErrors });
    }

    const user = await FcmToken.findOne({ userId: agentFound._id });

    if (!user) {
      await FcmToken.create({
        userId: agentFound._id,
        token: fcmToken,
      });
    } else {
      if (user.token === null || user.token !== fcmToken) {
        await FcmToken.findByIdAndUpdate(user._id, {
          token: fcmToken,
        });
      }
    }

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
    const agentId = req.userAuth;

    const agentFound = await Agent.findById(agentId);

    if (!agentFound) {
      return next(appError("Agent not found", 400));
    }

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
      agentId: agentFound._id,
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

//Get Agent's profile
const getAgentProfileDetailsController = async (req, res, next) => {
  try {
    const currentAgent = await Agent.findById(req.userAuth).select(
      "fullName phoneNumber email agentImageURL governmentCertificateDetail"
    );

    if (!currentAgent) {
      return next(appError("Agent not found", 404));
    }

    res.status(200).json({ message: "Agent profile data", data: currentAgent });
  } catch (err) {
    next(appError(err.message));
  }
};

//Edit Agent's profile
const editAgentProfileController = async (req, res, next) => {
  const { email, fullName } = req.body;

  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const agentToUpdate = await Agent.findById(req.userAuth);

    if (!agentToUpdate) {
      return next(appError("Agent not Found", 404));
    }

    let agentImageURL = agentToUpdate?.agentImageURL;

    if (req.file) {
      await deleteFromFirebase(agentImageURL);
      agentImageURL = await uploadToFirebase(req.file, "AgentImages");
    }

    await Agent.findByIdAndUpdate(
      req.userAuth,
      { email, fullName, agentImageURL },
      { new: true }
    );

    res.status(200).json({
      message: "Agent updated successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const deleteAgentProfileController = async (req, res, next) => {
  try {
    const agentId = req.userAuth;

    const agentFound = await Agent.findById(agentId);

    if (!agentFound) {
      return next(appError("Agent not found", 404));
    }

    await Agent.findByIdAndDelete(agentId);

    res.status(200).json({ message: "Agent profile deleted successfully" });
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

    if (!currentAgent) {
      return next(appError("Agent not found", 404));
    }

    const bankDetails = {
      accountHolderName,
      accountNumber,
      IFSCCode,
      UPIId,
    };

    currentAgent.bankDetail = bankDetails;

    await currentAgent.save();

    res
      .status(200)
      .json({ message: "Agent's bank details added successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

//Get Bank account details controller
const getBankDetailController = async (req, res, next) => {
  try {
    const currentAgent = await Agent.findById(req.userAuth);

    if (!currentAgent) {
      return next(appError("Agent not found", 404));
    }

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

//Add agent's vehicle details
const addVehicleDetailsController = async (req, res, next) => {
  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const agentFound = await Agent.findById(req.userAuth);

    if (!agentFound) {
      return next(appError("Agent not found", 404));
    }

    const { model, type, licensePlate } = req.body;

    const rcFrontImage = req.files.rcFrontImage[0];
    const rcBackImage = req.files.rcBackImage[0];

    const rcFrontImageURL = await uploadToFirebase(rcFrontImage, "RCImages");
    const rcBackImageURL = await uploadToFirebase(rcBackImage, "RCImages");

    // Uploading vehicle images and details
    const newVehicle = {
      _id: new mongoose.Types.ObjectId(),
      model,
      type,
      licensePlate,
      rcFrontImageURL,
      rcBackImageURL,
    };

    // Adding the new vehicle to the agent's vehicle details array
    agentFound.vehicleDetail.push(newVehicle);

    await agentFound.save();

    res.status(200).json({
      message: "Agent's vehicle details added successfully",
      data: agentFound.vehicleDetails,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Edit agent's vehicle details
const editAgentVehicleController = async (req, res, next) => {
  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(400).json({ errors: formattedErrors });
  }

  try {
    const currentAgent = await Agent.findById(req.userAuth);

    if (!currentAgent) {
      return next(appError("Agent not found", 404));
    }

    const { vehicleId } = req.params;
    const vehicle = currentAgent.vehicleDetail.id(vehicleId);

    if (!vehicle) {
      return next(appError("Vehicle not found", 404));
    }

    let rcFrontImageURL = vehicle.rcFrontImageURL;
    let rcBackImageURL = vehicle.rcBackImageURL;

    // If new images are provided, upload them and update URLs
    if (req.files && req.files.rcFrontImage) {
      await deleteFromFirebase(rcFrontImageURL);
      rcFrontImageURL = await uploadToFirebase(
        req.files.rcFrontImage[0],
        "RCImages"
      );
    }
    if (req.files && req.files.rcBackImage) {
      await deleteFromFirebase(rcBackImageURL);
      rcBackImageURL = await uploadToFirebase(
        req.files.rcBackImage[0],
        "RCImages"
      );
    }

    // Update vehicle details
    vehicle.model = req.body.model || vehicle.model;
    vehicle.type = req.body.type || vehicle.type;
    vehicle.licensePlate = req.body.licensePlate || vehicle.licensePlate;
    vehicle.rcFrontImageURL = rcFrontImageURL;
    vehicle.rcBackImageURL = rcBackImageURL;
    vehicle.vehicleStatus =
      req.body.vehicleStatus !== undefined
        ? req.body.vehicleStatus
        : vehicle.vehicleStatus;

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

    if (!currentAgent) {
      return next(appError("Agent not found", 404));
    }

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

    if (!currentAgent) {
      return next(appError("Agent not found", 404));
    }

    const { vehicleId } = req.params;
    const vehicle = currentAgent.vehicleDetail.id(vehicleId);

    if (!vehicle) {
      return next(appError("Vehicle not found", 404));
    }

    res.status(200).json({
      message: "Vehicle details fetched successfully",
      data: vehicle,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

//Add agent's government certificates
const addGovernmentCertificatesController = async (req, res, next) => {
  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const agentFound = await Agent.findById(req.userAuth);

    if (!agentFound) {
      return next(appError("Agent not found", 404));
    }

    // Uploading government certificate images
    let aadharFrontImageURL = "";
    let aadharBackImageURL = "";
    let drivingLicenseFrontImageURL = "";
    let drivingLicenseBackImageURL = "";

    if (req.files.aadharFrontImage) {
      aadharFrontImageURL = await uploadToFirebase(
        req.files.aadharFrontImage[0],
        "AadharImages"
      );
    }

    if (req.files.aadharBackImage) {
      aadharBackImageURL = await uploadToFirebase(
        req.files.aadharBackImage[0],
        "AadharImages"
      );
    }

    if (req.files.drivingLicenseFrontImage) {
      drivingLicenseFrontImageURL = await uploadToFirebase(
        req.files.drivingLicenseFrontImage[0],
        "DrivingLicenseImages"
      );
    }

    if (req.files.drivingLicenseBackImage) {
      drivingLicenseBackImageURL = await uploadToFirebase(
        req.files.drivingLicenseBackImage[0],
        "DrivingLicenseImages"
      );
    }

    const governmentCertificateDetail = {
      aadharNumber: req.body.aadharNumber,
      aadharFrontImageURL,
      aadharBackImageURL,
      drivingLicenseNumber: req.body.drivingLicenseNumber,
      drivingLicenseFrontImageURL,
      drivingLicenseBackImageURL,
    };

    //saving government certificate detail
    agentFound.governmentCertificateDetail = governmentCertificateDetail;
    await agentFound.save();

    res.status(200).json({
      message: "Agent government certificates added successfully",
      data: agentFound.governmentCertificateDetail,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

//Change agent's status to Free
const toggleOnlineController = async (req, res, next) => {
  try {
    const currentAgent = await Agent.findById(req.userAuth);

    if (!currentAgent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    // Ensure appDetail exists
    if (!currentAgent.appDetail) {
      currentAgent.appDetail = {
        orders: 0,
        pendingOrder: 0,
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

    if (!agentFound) {
      return next(appError("Agent not found", 404));
    }

    const { vehicleId } = req.params;

    const vehicleIndex = agentFound.vehicleDetail.findIndex(
      (vehicle) => vehicle._id.toString() === vehicleId
    );

    if (vehicleIndex === -1) {
      return next(appError("Vehicle not found", 404));
    }

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

    if (!agentFound) {
      return next(appError("Agent not found", 404));
    }

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

    if (!vehicleFound) {
      return next(appError("Vehicle not found", 404));
    }

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
    const currentAgent = req.userAuth;

    const { orderId } = req.params;

    const { rating, review } = req.body;

    const orderFound = await Order.findById(orderId);

    if (!orderFound) {
      return next(appError("Order not found", 404));
    }

    const customerFound = await Customer.findById(orderFound.customerId);

    if (!customerFound) {
      return next(appError("Customer not found", 404));
    }

    orderFound.orderRating.ratingByDeliveryAgent.review = review;
    orderFound.orderRating.ratingByDeliveryAgent.rating = rating;

    let updatedCustomerRating = {
      agentId: currentAgent,
      review,
      rating,
    };

    customerFound.ratingsByAgents.push(updatedCustomerRating);

    await orderFound.save();
    await customerFound.save();

    res.status(200).josn({ message: "Customer rated successfully" });
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

    if (!agentFound) {
      return next(appError("Agent not found", 404));
    }

    const formattedResponse = {
      totalEarning: agentFound?.appDetail?.totalEarning || "0.0",
      orders: agentFound?.appDetail?.orders || 0,
      pendingOrders: agentFound?.appDetail?.pendingOrder || 0,
      totalDistance: agentFound?.appDetail?.totalDistance || "0.0",
      averageRating: agentFound.averageRating || "0.0",
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

    if (!agentFound) {
      return next(appError("Agent not found", 404));
    }

    agentFound.appDetailHistory.push({
      date: new Date(),
      details: {
        ...agentFound.appDetail,
        orderDetail: agentFound.appDetail.orderDetail,
      },
    });

    // Sort the appDetailHistory by date in descending order (latest date first)
    const sortedAppDetailHistory = agentFound?.appDetailHistory?.sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    const formattedResponse = sortedAppDetailHistory?.map((history) => {
      return {
        date: formatDate(history?.date) || formatDate(new Date()),
        details: {
          totalEarnings: history?.details?.totalEarning?.toFixed(2) || "0.00",
          orders: history?.details?.orders || 0,
          cancelledOrders: history?.details?.cancelledOrders || 0,
          totalDistance:
            `${history?.details?.totalDistance?.toFixed(2)} km` || "0.00 km",
          loginHours:
            formatToHours(history?.details?.loginDuration) || "0:00 hr",
          orderDetail:
            history?.details?.orderDetail?.map((order) => ({
              orderId: order.orderId,
              deliveryMode: order.deliveryMode,
              customerName: order.customerName,
              grandTotal: order.grandTotal,
              date: formatDate(order.completedOn),
              time: formatTime(order.completedOn),
            })) || [],
        },
      };
    });

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

    const agentFound = await Agent.findById(agentId).populate({
      path: "ratingsByCustomers",
      populate: {
        path: "customerId",
        model: "Customer",
        select: "fullName _id", // Selecting the fields of fullName and _id from Agent
      },
    });

    if (!agentFound) {
      return next(appError("Agent not found", 404));
    }

    const ratingsOfAgent = agentFound?.ratingsByCustomers.reverse();

    const formattedRatingAndReviews = ratingsOfAgent?.map((rating) => ({
      review: rating.review,
      rating: rating.rating,
      customerId: {
        id: rating.customerId._id,
        fullName: rating.customerId.fullName || "-",
      },
    }));

    res.status(200).json({
      message: "Ratings of agent",
      averageRating: agentFound?.averageRating || 0,
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

    if (!agentFound) {
      return next(appError("Agent not found", 404));
    }

    const taskFound = await Task.find({
      agentId,
      taskStatus: "Assigned",
    })
      .populate("orderId")
      .sort({ createdAt: 1 });

    let currentTasks = [];
    let nextTasks = [];

    taskFound.forEach((task) => {
      const pickupTask = {
        type: "Pickup",
        taskId: task._id,
        taskStatus: task.pickupDetail.pickupStatus, // === "Pending" ? "Accepted" : "Started",
        orderId: task.orderId?._id,
        orderType: task?.orderId?.orderDetail?.deliveryMode || null,
        date: formatDate(task.createdAt),
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

      const deliveryTask = {
        type: "Delivery",
        taskId: task._id,
        taskStatus: task.deliveryDetail.deliveryStatus,
        // === "Pending"
        // ? "Accepted"
        // : "Started",
        orderId: task.orderId?._id,
        orderType: task?.orderId?.orderDetail?.deliveryMode || null,
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

      if (task.pickupDetail.pickupStatus === "Started") {
        currentTasks.push(pickupTask);
      } else if (task.pickupDetail.pickupStatus !== "Completed") {
        nextTasks.push(pickupTask);
      }

      if (task.deliveryDetail.deliveryStatus === "Started") {
        currentTasks.push(deliveryTask);
      } else if (task.deliveryDetail.deliveryStatus !== "Completed") {
        nextTasks.push(deliveryTask);
      }
    });

    console.log(currentTasks);
    console.log(nextTasks);

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

    const formattedResponse = {
      taskId: taskFound._id,
      orderId: taskFound.orderId._id,
      messageReceiverId:
        taskFound?.orderId?.merchantId ||
        taskFound?.orderId?.customerId ||
        null,
      type: "Pickup",
      date: formatDate(taskFound.orderId.createdAt),
      time: formatTime(taskFound.orderId.createdAt),
      taskStatus: taskFound.pickupDetail?.pickupStatus,
      pickupName: taskFound?.pickupDetail?.pickupAddress?.fullName,
      pickupAddress: taskFound?.pickupDetail?.pickupAddress?.area,
      pickupPhoneNumber:
        taskFound?.pickupDetail?.pickupAddress?.phoneNumber || null,
      instructions:
        taskFound?.orderId?.orderDetail?.instructionInPickup || null,
      voiceInstructions:
        taskFound?.orderId?.orderDetail?.voiceInstructionToDeliveryAgent ||
        null,
      pickupLocation: taskFound?.pickupDetail?.pickupLocation,
      deliveryMode: taskFound.orderId.orderDetail.deliveryMode,
      orderItems: taskFound.orderId.items,
      billDetail: taskFound.orderId.billDetail,
      paymentMode: taskFound.orderId.paymentMode,
      paymentStatus: taskFound.orderId.paymentStatus,
    };

    res.status(200).json({
      message: "Pick up details.",
      data: formattedResponse,
    });
  } catch (err) {
    next(appError);
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
        taskFound?.orderId?.orderDetail?.instructionToDeliveryAgent ||
        taskFound?.orderId?.orderDetail?.instructionInDelivery,
      voiceInstructions:
        taskFound?.orderId?.orderDetail?.voiceInstructionToDeliveryAgent,
      deliveryLocation: taskFound?.deliveryDetail?.deliveryLocation,
      deliveryMode: taskFound.orderId.orderDetail.deliveryMode,
      orderItems: taskFound.orderId.items,
      billDetail: taskFound.orderId.billDetail,
      paymentMode: taskFound.orderId.paymentMode,
      paymentStatus: taskFound.orderId.paymentStatus,
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

    if (!price || isNaN(price)) {
      return next(appError("Invalid price", 400));
    }

    const orderFound = await Order.findById(orderId);

    if (!orderFound) {
      return next(appError("Order not found", 404));
    }

    if (orderFound.agentId.toString() !== agentId.toString()) {
      return next(appError("Agent access denied", 403));
    }

    const itemFound = orderFound.items.find(
      (item) => item.itemId.toString() === itemId.toString()
    );

    if (!itemFound) {
      return next(appError("Item not found", 404));
    }

    // Calculate the difference in price
    const oldPrice = itemFound.price || 0;
    const newPrice = parseFloat(price);

    // Update item price
    itemFound.price = newPrice;

    // Calculate the updated item total
    const updatedItemTotal = orderFound.items.reduce((total, item) => {
      return total + (item.price || 0);
    }, 0);

    const deliveryCharge = orderFound.billDetail.deliveryCharge || 0;
    const surgePrice = orderFound.billDetail.surgePrice || 0;

    // Update subTotal and grandTotal
    const updatedSubTotal = (
      updatedItemTotal +
      deliveryCharge +
      surgePrice
    ).toFixed(2);
    const updatedGrandTotal = (
      parseFloat(orderFound.billDetail.grandTotal || 0) +
      newPrice -
      oldPrice
    ).toFixed(2);

    orderFound.billDetail.itemTotal = parseFloat(updatedItemTotal.toFixed(2));
    orderFound.billDetail.subTotal = parseFloat(updatedSubTotal);
    orderFound.billDetail.grandTotal = parseFloat(updatedGrandTotal);

    await orderFound.save();

    res.status(200).json({
      message: "Item price updated successfully",
      data: price,
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

    const orderFound = await Order.findById(orderId);
    const agentFound = await Agent.findById(orderId.agentId);

    if (!orderFound || !agentFound) {
      return next(appError("Order or Agent not found", 404));
    }

    let signatureImageURL = "";
    let imageURL = "";

    if (req.files) {
      if (req.files.signatureImage) {
        const signatureImage = req.files.signatureImage[0];
        signatureImageURL = await uploadToFirebase(
          signatureImage,
          "OrderDetailImages"
        );
      }

      if (req.files.image) {
        const image = req.files.image[0];
        imageURL = await uploadToFirebase(image, "OrderDetailImages");
      }
    }

    // Create the updated details object
    let updatedDetails = {};
    if (notes) {
      updatedDetails.notes = notes;
    }
    if (signatureImageURL) {
      updatedDetails.signatureImageURL = signatureImageURL;
    }
    if (imageURL) {
      updatedDetails.imageURL = imageURL;
    }

    // Merge existing details with updated details
    orderFound.detailAddedByAgent = {
      ...orderFound?.detailAddedByAgent?.toObject(),
      ...updatedDetails,
    };

    // Save the updated order
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

    const agentFound = await Agent.findById(agentId);

    if (!agentFound) {
      return next(appError("Agent not found", 404));
    }

    if (!amount && isNaN(amount)) {
      return next(appError("Amount must be a number"));
    }

    const orderFound = await Order.findById(orderId);

    if (!orderFound) {
      return next(appError("Order not found", 404));
    }

    if (orderFound.billDetail.grandTotal !== amount) {
      return next(appError("Enter the correct bill amount"));
    }

    let updatedOrderDetail = {
      orderId,
      deliveryMode: orderFound.orderDetail.deliveryMode,
      customerName: orderFound.orderDetail.deliveryAddress.fullName || "-",
      completedOn: new Date(),
      grandTotal: orderFound.billDetail.grandTotal,
    };

    agentFound.workStructure.cashInHand += parseInt(amount);
    agentFound.appDetail.orderDetail.push(updatedOrderDetail);

    await agentFound.save();

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

    const orderAmount = orderFound.billDetail.grandTotal;

    // Calculate loyalty points for customer
    const loyaltyPointCriteria = await LoyaltyPoint.findOne({ status: true });
    if (
      loyaltyPointCriteria &&
      orderAmount >= loyaltyPointCriteria.minOrderAmountForEarning
    ) {
      updateLoyaltyPoints(customerFound, loyaltyPointCriteria, orderAmount);
    }

    // Calculate referral rewards for customer
    if (!customerFound?.referralDetail?.processed) {
      await processReferralRewards(customerFound, orderAmount);
    }

    // Calculate earnings for agent
    const calculatedSalary = await calculateAgentEarnings(
      agentFound,
      orderFound
    );

    // Update order details
    updateOrderDetails(orderFound, calculatedSalary);

    await updateCustomerSubscriptionCount(customerFound._id);

    await updateNotificationStatus(orderId);

    // Update agent details
    await updateAgentDetails(agentFound, orderFound, calculatedSalary, true);

    await Promise.all([
      orderFound.save(),
      customerFound.save(),
      agentFound.save(),
    ]);

    const stepperDetail = {
      by: agentFound.fullName,
      date: new Date(),
    };

    orderFound.orderStepperDetil.completed = stepperDetail;

    await orderFound.save();

    const agent = await Agent.findByIdAndUpdate(agentId, {
      $inc: { taskCompleted: 1 },
      "appDetail.orders": { $inc: 1 },
    });

    await agent.save();

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

    if (!orderFound) {
      return next(appError("Order not found", 404));
    }

    const customerFound = await Customer.findById(orderFound.customerId);

    if (!customerFound) {
      return next(appError("Customer not found", 404));
    }

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

    await orderFound.save();
    await customerFound.save();

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
      return next(appError("agnet not found", 404));
    }

    const cashInHand = agentFound.workStructure.cashInHand;

    res.status(200).json({ message: "Cash in hand", data: cashInHand });
  } catch (err) {
    next(appError(err.message));
  }
};

// Initiate deposite by razorpay
const depositeCashToFamtoController = async (req, res, next) => {
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

// verify deposit by razorpay
const verifyDepositController = async (req, res, next) => {
  try {
    const { paymentDetails, amount } = req.body;
    const agentId = req.userAuth;

    const agentFound = await Agent.findById(agentId);

    if (!agentFound) {
      return next(appError("agnet not found", 404));
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

    res.status(200).josn({ message: "Deposite verified successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get transaction history of agents
const getAgentTransactionsController = async (req, res, next) => {
  try {
    const agentId = req.userAuth;

    const agentFound = await Agent.findById(agentId);

    if (!agentFound) {
      return next(appError("agnet not found", 404));
    }

    // Sort the transactions by date in descending order (latest date first)
    const sortedTransactionHistory = agentFound?.agentTransaction?.sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    const formattedResponse = sortedTransactionHistory?.map((transaction) => {
      return {
        imageURL: agentFound.agentImageURL,
        fullName: agentFound.fullName,
        date: formatDate(transaction.madeOn),
        time: formatTime(transaction.madeOn),
        amount: transaction.amount,
        type: transaction.type,
      };
    });

    res.status(200).json({
      message: "Agent transaction history",
      data: formattedResponse || [],
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

    if (!orderFound) {
      return next(appError("Order not found", 404));
    }

    if (orderFound.agentId !== agentId) {
      return next(appError("Agent access denied (Different agent)"));
    }

    const agentLocation = [latitude, longitude];

    let updatedData = {
      agentLocation,
      status,
      description,
    };

    let oldDistance = orderFound.orderDetail?.distance || 0;

    const lastLocation =
      orderFound.detailAddedByAgent.shopUpdates.length > 0
        ? orderFound.detailAddedByAgent.shopUpdates[
            orderFound.detailAddedByAgent.shopUpdates.length - 1
          ].location
        : null;

    // Ensure getDistanceFromPickupToDelivery returns a number
    const { distanceInKM } = await getDistanceFromPickupToDelivery(
      agentLocation,
      lastLocation
    );

    const newDistance = parseFloat(distanceInKM);

    orderFound.orderDetail.distance = oldDistance + newDistance;

    // Calculate delivery charges
    const { deliveryCharges } = await getDeliveryAndSurgeCharge(
      orderFound.customerId,
      orderFound.orderDetail.deliveryMode,
      distanceInKM
    );

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

    orderFound.detailAddedByAgent.shopUpdates.push(updatedData);

    await orderFound.save();

    res.status(200).json({
      message: "Shop updated successfully in custom order",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get agent earinig for the delivery
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

      console.log("Payment Captured:");
      console.log("Payment ID:", paymentData.id);
      console.log("Amount:", paymentData.amount);
      console.log("Currency:", paymentData.currency);

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

    const getAllNotifications = await AgentNotificationLogs.find({
      agentId,
    }).sort({
      createdAt: -1,
    });

    const formattedResponse = getAllNotifications?.map((notification) => {
      return {
        notificationId: notification._id || null,
        orderId: notification?.orderId || null,
        pickupDetail: notification?.pickupDetail?.address || null,
        deliveryDetail: notification?.deliveryDetail?.address || null,
        orderType: notification?.orderType || null,
        status: notification?.status || null,
        taskDate: formatDate(notification.createdAt) || null,
        taskTime: formatTime(notification.createdAt) || null,
      };
    });

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
  depositeCashToFamtoController,
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
};
