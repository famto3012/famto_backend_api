const { validationResult } = require("express-validator");
const Agent = require("../../models/Agent");
const {
  uploadToFirebase,
  deleteFromFirebase,
} = require("../../utils/imageOperation");
const Geofence = require("../../models/Geofence");
const generateToken = require("../../utils/generateToken");
const geoLocation = require("../../utils/getGeoLocation");
const appError = require("../../utils/appError");
const { default: mongoose } = require("mongoose");
const Customer = require("../../models/Customer");
const Order = require("../../models/Order");
const { formatLoginDuration } = require("../../utils/agentAppHelpers");
const { formatDate, formatTime } = require("../../utils/formatters");
const Task = require("../../models/Task");

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

    const geofence = await geoLocation(latitude, longitude, next);

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

    const geofence = await geoLocation(latitude, longitude, next);

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

    res.status(200).json({
      message: "Agent registering successfully",
      token: generateToken(newAgent._id, newAgent.role),
    });
  } catch (err) {
    next(appError(err.message));
  }
};

//Agent login Controller
const agentLoginController = async (req, res, next) => {
  const { phoneNumber } = req.body;

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

    res.status(200).json({
      message: "Agent Login successful",
      token: generateToken(agentFound._id, agentFound.role),
    });
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

    let agentImageURL = agentToUpdate.agentImageURL;

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

//Check is Approved
const checkIsApprovedController = async (req, res, next) => {
  try {
    const currentAgent = await Agent.findById(req.userAuth);

    const status = currentAgent.isApproved;

    let message = "";
    if (status === "Approved") {
      message = "Registration is approved";
    } else {
      message = "Registration is pending";
    }

    res.status(200).json({
      message: message,
      data: status,
    });
  } catch (err) {
    next(appError);
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

    // Uploading vehicle images and details
    const newVehicle = {
      _id: new mongoose.Types.ObjectId(),
      model,
      type,
      licensePlate,
      rcFrontImageURL: rcFrontImage
        ? await uploadToFirebase(rcFrontImage, "RCImages")
        : "",
      rcBackImageURL: rcBackImage
        ? await uploadToFirebase(rcBackImage, "RCImages")
        : "",
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
    return res.status(500).json({ errors: formattedErrors });
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
      vehicle.rcFrontImageURL = await uploadToFirebase(
        req.files.rcFrontImage[0],
        "RCImages"
      );
    }
    if (req.files && req.files.rcBackImage) {
      await deleteFromFirebase(rcBackImageURL);
      vehicle.rcBackImageURL = await uploadToFirebase(
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

    if (currentAgent.status === "Free") {
      currentAgent.status = "Inactive";

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

      // Set the start time when the agent goes online
      currentAgent.loginStartTime = new Date();
    }

    await currentAgent.save();

    res
      .status(200)
      .json({ message: `Agent status changed to ${currentAgent.status}` });
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
        vehicle.vehicleStatus = true;
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
      totalEarnings: agentFound?.appDetail?.totalEarnings || "0.0",
      orders: agentFound?.appDetail?.orders || 0,
      pendingOrders: agentFound?.appDetail?.pendingOrders || 0,
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

    // Sort the appDetailHistory by date in descending order (latest date first)
    const sortedAppDetailHistory = agentFound?.appDetailHistory?.sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    console.log(sortedAppDetailHistory);

    const formattedResponse = sortedAppDetailHistory?.map((history) => {
      return {
        date: formatDate(history.date),
        details: {
          totalEarnings: history.details.totalEarning?.toFixed(2) || "0.00",
          orders: history.details.orders || 0,
          cancelledOrders: history.details.cancelledOrders || 0,
          totalDistance:
            `${history.details.totalDistance?.toFixed(2)} km` || "0.00 km",
          loginHours:
            formatLoginDuration(history.details.loginDuration) || "0:00 hr",
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
        fullName: rating.customerId.fullName || "N/A",
      },
    }));

    res.status(200).json({
      message: "Ratings of agent",
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

    const taskFound = await Task.find({ agentId })
      .populate("orderId")
      .sort({ createdAt: -1 });

    const formattedTask = taskFound.map((task) => {
      return {
        taskStatus: task.taskStatus,
        orderId: task.orderId._id,
        deliveryMode: task.orderId.orderDetail.deliveryMode,
        date: formatDate(task.createdAt),
        time: formatTime(task.createdAt),
        merchantName: task.orderId.orderDetail.pickupAddress.fullName,
        merchantAddress: task.orderId.orderDetail.pickupAddress.area,
        merchantPhoneNumber: task.orderId.orderDetail.pickupAddress.phoneNumber,
        pickupLocation: task.orderId.orderDetail.pickupLocation,
        agentLocation: agentFound.location,
      };
    });

    const currentTask = formattedTask.filter((task) => {
      return task.taskStatus === "Started";
    });

    res.status(200).json({
      message: "Task preview",
      data: { currentTask, nextTask: formattedTask },
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  updateLocationController,
  registerAgentController,
  agentLoginController,
  getAgentProfileDetailsController,
  editAgentProfileController,
  updateAgentBankDetailController,
  getBankDetailController,
  checkIsApprovedController,
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
};
