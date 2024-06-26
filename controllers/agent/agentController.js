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

//Function for getting agent's manager from geofence
const getManager = async (geofenceId) => {
  const geofenceFound = await Geofence.findOne({ _id: geofenceId });

  const geofenceManager = geofenceFound.orderManager;

  console.log("geoFenceManager", geofenceManager);

  return geofenceManager;
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

    const geofenceId = await geoLocation(latitude, longitude, next);
    console.log("geofenceId", geofenceId);
    const manager = await getManager(geofenceId);

    let agentImageURL = "";

    if (req.file) {
      agentImageURL = await uploadToFirebase(req.file, "AgentImages");
    }

    const newAgent = await Agent.create({
      fullName,
      email,
      phoneNumber,
      location,
      geofenceId,
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
const goOnlineController = async (req, res, next) => {
  try {
    const currentAgent = await Agent.findById(req.userAuth);

    currentAgent.status = "Free";

    currentAgent.save();

    res.status(200).json({ message: "Agent is online" });
  } catch (err) {
    next(appError(err.message));
  }
};

//Change agent's status to Inactive
const goOfflineController = async (req, res, next) => {
  try {
    const currentAgent = await Agent.findById(req.userAuth);

    currentAgent.status = "Inactive";

    currentAgent.save();

    res.status(200).json({ message: "Agent is offline" });
  } catch (err) {
    next(appError(err.message));
  }
};

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

module.exports = {
  registerAgentController,
  agentLoginController,
  getAgentProfileDetailsController,
  editAgentProfileController,
  updateAgentBankDetailController,
  getBankDetailController,
  checkIsApprovedController,
  addVehicleDetailsController,
  addGovernmentCertificatesController,
  goOnlineController,
  goOfflineController,
  getAllVehicleDetailsController,
  getSingleVehicleDetailController,
  editAgentVehicleController,
  deleteAgentVehicleController,
  changeVehicleStatusController,
};
