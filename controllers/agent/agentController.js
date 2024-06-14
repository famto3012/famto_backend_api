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

    if (!agentFound.isApproved || agentFound.isBlocked) {
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

//Controller for adding agent's Government certificate & Vehicle details
const submitGovernmentAndVehicleDetailsController = async (req, res, next) => {
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

    // Uploading vehicle images
    const vehicleDetailsPromises = req.body.vehicles.map(
      async (vehicle, index) => ({
        model: vehicle.model,
        type: vehicle.type,
        licensePlate: vehicle.licensePlate,
        rcFrontImageURL: req.files.vehicles[index * 2]
          ? await uploadToFirebase(req.files.vehicles[index * 2], "RCImages")
          : "",
        rcBackImageURL: req.files.vehicles[index * 2 + 1]
          ? await uploadToFirebase(
              req.files.vehicles[index * 2 + 1],
              "RCImages"
            )
          : "",
      })
    );

    const vehicleDetails = await Promise.all(vehicleDetailsPromises);

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

    // Saving the details to the agent
    agentFound.vehicleDetail = vehicleDetails;
    agentFound.governmentCertificateDetail = governmentCertificateDetail;

    await agentFound.save();

    res.status(200).json({
      message: "Agent details updated successfully",
      data: agentFound,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

//Controller for getting images of details
const getImagesOfDetailsController = async (req, res, next) => {
  try {
    const currentAgent = await Agent.findById(req.userAuth);

    if (!currentAgent) {
      return next(appError("Agent not found", 404));
    }

    const vehicleDetail = currentAgent.vehicleDetail;
    const governmentCertificate = currentAgent.governmentCertificateDetail;

    const rcImages = vehicleDetail.map((vehicle) => ({
      rcFrontImageURL: vehicle.rcFrontImageURL,
      rcBackImageURL: vehicle.rcBackImageURL,
    }));

    res.status(200).json({
      message: "Details",
      rcImages,
      aadharFrontImageURL: governmentCertificate.aadharFrontImageURL,
      aadharBackImageURL: governmentCertificate.aadharBackImageURL,
      drivingLicenseFrontImageURL:
        governmentCertificate.drivingLicenseFrontImageURL,
      drivingLicenseBackImageURL:
        governmentCertificate.drivingLicenseBackImageURL,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

//Get Agent's profile
const getAgentProfileDetailsController = async (req, res, next) => {
  try {
    const currentAgent = await Agent.findById(req.userAuth).select(
      "fullName phoneNumber email agentImageURL"
    );

    if (!currentAgent) {
      return next(appError("Agent not found", 404));
    }

    const agentData = {
      fullName: currentAgent.fullName,
      email: currentAgent.email,
      phoneNumber: currentAgent.phoneNumber,
      agentImageURL: currentAgent.agentImageURL,
    };

    res.status(200).json({ message: "Agent profile data", data: agentData });
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
    const agentToUpdate = await Agent.findById(req.params.agentId);

    if (req.userAuth !== req.params.agentId) {
      return next(appError("Access Denied", 403));
    }

    if (!agentToUpdate) {
      return next(appError("Agent not Found", 404));
    }

    let agentImageURL = agentToUpdate.agentImageURL;

    if (req.file) {
      await deleteFromFirebase(agentImageURL);
      agentImageURL = await uploadToFirebase(req.file, "AgentImages");
    }

    await Agent.findByIdAndUpdate(
      req.params.agentId,
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

//Add Bank account details controller
const addAgentBankDetailController = async (req, res, next) => {
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

//Edit Bank account details controller
const editAgentBankDetailController = async (req, res, next) => {
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
    const agentToUpdate = await Agent.findById(req.params.agentId);

    if (req.userAuth !== req.params.agentId) {
      return next(appError("Access Denied", 403));
    }

    if (!agentToUpdate) {
      return next(appError("Agent not Found", 404));
    }

    const bankDetails = {
      accountHolderName,
      accountNumber,
      IFSCCode,
      UPIId,
    };

    agentToUpdate.bankDetail = bankDetails;

    await agentToUpdate.save();

    res
      .status(200)
      .json({ message: "Agent's bank details updated successfully" });
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

//TODO: Edit agent by admin

module.exports = {
  registerAgentController,
  agentLoginController,
  submitGovernmentAndVehicleDetailsController,
  getImagesOfDetailsController,
  getAgentProfileDetailsController,
  editAgentProfileController,
  addAgentBankDetailController,
  editAgentBankDetailController,
  getBankDetailController,
};
