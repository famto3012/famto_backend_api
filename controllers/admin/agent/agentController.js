const { validationResult } = require("express-validator");
const appError = require("../../../utils/appError");
const {
  uploadToFirebase,
  deleteFromFirebase,
} = require("../../../utils/imageOperation");
const Agent = require("../../../models/Agent");
const { default: mongoose } = require("mongoose");

const addAgentByAdminController = async (req, res, next) => {
  const {
    fullName,
    phoneNumber,
    email,
    managerId,
    salaryStructureId,
    geofenceId,
    tag,
    aadharNumber,
    drivingLicenseNumber,
    model,
    type,
    licensePlate,
    accountHolderName,
    accountNumber,
    IFSCCode,
    UPIId,
  } = req.body;

  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    let rcFrontImageURL = "";
    let rcBackImageURL = "";
    let aadharFrontImageURL = "";
    let aadharBackImageURL = "";
    let drivingLicenseFrontImageURL = "";
    let drivingLicenseBackImageURL = "";
    let agentImageURL = "";

    if (req.files) {
      const {
        rcFrontImage,
        rcBackImage,
        aadharFrontImage,
        aadharBackImage,
        drivingLicenseFrontImage,
        drivingLicenseBackImage,
        agentImage,
      } = req.files;

      if (rcFrontImage) {
        rcFrontImageURL = await uploadToFirebase(rcFrontImage[0], "RCImages");
      }
      if (rcBackImage) {
        rcBackImageURL = await uploadToFirebase(rcBackImage[0], "RCImages");
      }
      if (aadharFrontImage) {
        aadharFrontImageURL = await uploadToFirebase(
          aadharFrontImage[0],
          "AadharImages"
        );
      }
      if (aadharBackImage) {
        aadharBackImageURL = await uploadToFirebase(
          aadharBackImage[0],
          "AadharImages"
        );
      }
      if (drivingLicenseFrontImage) {
        drivingLicenseFrontImageURL = await uploadToFirebase(
          drivingLicenseFrontImage[0],
          "DrivingLicenseImages"
        );
      }
      if (drivingLicenseBackImage) {
        drivingLicenseBackImageURL = await uploadToFirebase(
          drivingLicenseBackImage[0],
          "DrivingLicenseImages"
        );
      }
      if (agentImage) {
        agentImageURL = await uploadToFirebase(
          agentImage[0],
          "DrivingLicenseImages"
        );
      }
    }

    const newAgent = await Agent.create({
      fullName,
      phoneNumber,
      email,
      managerId,
      geofenceId,
      agentImageURL,
      workStructure: {
        salaryStructureId,
        tag,
      },
      bankDetail: {
        accountHolderName,
        accountNumber,
        IFSCCode,
        UPIId,
      },
      governmentCertificateDetail: {
        aadharNumber,
        aadharFrontImageURL,
        aadharBackImageURL,
        drivingLicenseNumber,
        drivingLicenseFrontImageURL,
        drivingLicenseBackImageURL,
      },
      vehicleDetail: {
        model,
        type,
        licensePlate,
        rcFrontImageURL,
        rcBackImageURL,
      },
    });

    if (!newAgent) {
      return next(appError("Error in adding new agent"));
    }

    res.status(200).json({
      message: "Add agent by admin",
      data: newAgent,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const editAgentByAdminController = async (req, res, next) => {
  const {
    fullName,
    phoneNumber,
    email,
    managerId,
    salaryStructureId,
    geofenceId,
    tag,
    aadharNumber,
    drivingLicenseNumber,
    model,
    type,
    licensePlate,
    accountHolderName,
    accountNumber,
    IFSCCode,
    UPIId,
  } = req.body;

  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const agentFound = await Agent.findById(req.params.agentId);

    if (!agentFound) {
      return next(appError("Agent not found", 404));
    }

    let rcFrontImageURL = agentFound.rcFrontImageURL;
    let rcBackImageURL = agentFound.rcBackImageURL;
    let aadharFrontImageURL = agentFound.aadharFrontImageURL;
    let aadharBackImageURL = agentFound.aadharBackImageURL;
    let drivingLicenseFrontImageURL = agentFound.drivingLicenseFrontImageURL;
    let drivingLicenseBackImageURL = agentFound.drivingLicenseBackImageURL;
    let agentImageURL = agentFound.agentImageURL;

    if (req.files) {
      const {
        rcFrontImage,
        rcBackImage,
        aadharFrontImage,
        aadharBackImage,
        drivingLicenseFrontImage,
        drivingLicenseBackImage,
        agentImage,
      } = req.files;

      if (rcFrontImage) {
        await deleteFromFirebase(rcFrontImageURL);
        rcFrontImageURL = await uploadToFirebase(rcFrontImage[0], "RCImages");
      }
      if (rcBackImage) {
        await deleteFromFirebase(rcBackImageURL);
        rcBackImageURL = await uploadToFirebase(rcBackImage[0], "RCImages");
      }
      if (aadharFrontImage) {
        await deleteFromFirebase(aadharFrontImageURL);
        aadharFrontImageURL = await uploadToFirebase(
          aadharFrontImage[0],
          "AadharImages"
        );
      }
      if (aadharBackImage) {
        await deleteFromFirebase(aadharBackImageURL);
        aadharBackImageURL = await uploadToFirebase(
          aadharBackImage[0],
          "AadharImages"
        );
      }
      if (drivingLicenseFrontImage) {
        await deleteFromFirebase(drivingLicenseFrontImageURL);
        drivingLicenseFrontImageURL = await uploadToFirebase(
          drivingLicenseFrontImage[0],
          "DrivingLicenseImages"
        );
      }
      if (drivingLicenseBackImage) {
        await deleteFromFirebase(drivingLicenseBackImageURL);
        drivingLicenseBackImageURL = await uploadToFirebase(
          drivingLicenseBackImage[0],
          "DrivingLicenseImages"
        );
      }
      if (agentImage) {
        await deleteFromFirebase(agentImageURL);
        agentImageURL = await uploadToFirebase(
          agentImage[0],
          "DrivingLicenseImages"
        );
      }
    }

    const updatedAgent = await Agent.findByIdAndUpdate(
      req.params.agentId,
      {
        fullName,
        phoneNumber,
        email,
        managerId,
        geofenceId,
        agentImageURL,
        workStructure: {
          salaryStructureId,
          tag,
        },
        bankDetail: {
          accountHolderName,
          accountNumber,
          IFSCCode,
          UPIId,
        },
        governmentCertificateDetail: {
          aadharNumber,
          aadharFrontImageURL,
          aadharBackImageURL,
          drivingLicenseNumber,
          drivingLicenseFrontImageURL,
          drivingLicenseBackImageURL,
        },
        vehicleDetail: {
          model,
          type,
          licensePlate,
          rcFrontImageURL,
          rcBackImageURL,
        },
      },
      { new: true }
    );

    if (!updatedAgent) {
      return next(appError("Error in editing agent"));
    }

    res.status(200).json({
      message: "Add agent by admin",
      data: updatedAgent,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getSingleAgentController = async (req, res, next) => {
  try {
    const agentFound = await Agent.findById(req.params.agentId)
      .populate("geofenceId", "name")
      .populate("managerId", "name")
      .populate("workStructure.salaryStructureId", "ruleName")
      .select("-ratingsByCustomers");

    if (!agentFound) {
      return next(appError("Agent not found", 404));
    }

    res.status(200).json({ message: "Agent by id", data: agentFound });
  } catch (err) {
    next(appError(err.message));
  }
};

const approveAgentRegistrationController = async (req, res, next) => {
  try {
    const agentFound = await Agent.findById(req.params.agentId);

    if (!agentFound) {
      return next(appError("Agent not found", 404));
    }

    agentFound.isApproved = "Approved";
    await agentFound.save();

    res.status(200).json({
      message: "Agent registration apporved",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const rejectAgentRegistrationController = async (req, res, next) => {
  try {
    const agentFound = await Agent.findById(req.params.agentId);

    if (!agentFound) {
      return next(appError("Agent not found", 404));
    }

    await Agent.findByIdAndDelete(req.params.agentId);

    res.status(200).json({
      message: "Agent registration rejected",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

//TODO: test api after customer added review for agent
const getRatingsByCustomerController = async (req, res, next) => {
  try {
    const agentFound = await Agent.findById(req.params.agentId).populate({
      path: "ratingsByCustomers",
      populate: {
        path: "customerId",
        model: "Customer",
        select: "fullName _id", // Selecting the fields of fullName and _id from Customer
      },
    });

    if (!agentFound) {
      return next(appError("Agent not found", 404));
    }

    const ratings = agentFound.ratingsByCustomers.map((rating) => ({
      review: rating.review,
      rating: rating.rating,
      customerId: {
        id: rating.customerId._id,
        fullName: rating.customerId.fullName,
      },
    }));

    res.status(200).json({
      message: "Ratings of agent by customer",
      data: ratings,
    });
  } catch (err) {
    next(err.message);
  }
};

const getAgentByVehicleTypeController = async (req, res, next) => {
  try {
    const { vehicleType } = req.query;

    if (!vehicleType) {
      return res.status(400).json({ message: "Vehicle type is required" });
    }

    const searchTerm = vehicleType.trim();

    const searchResults = await Agent.find(
      { "vehicleDetail.type": { $regex: searchTerm, $options: "i" } },
      // Specifying the fields needed to include in the response
      "_id fullName email phoneNumber manager geofence status isApproved"
    );

    res.status(200).json({
      message: "Getting agent by vehicle type",
      data: searchResults,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAgentByGeofenceController = async (req, res, next) => {
  try {
    const { geofence } = req.query;

    if (!geofence) {
      return res.status(400).json({ message: "Geofence is required" });
    }

    // Convert geofence query parameter to ObjectId
    const geofenceObjectId = new mongoose.Types.ObjectId(geofence.trim());

    const searchResults = await Agent.find(
      { geofenceId: geofenceObjectId },
      // Specifying the fields needed to include in the response
      "_id fullName email phoneNumber manager geofenceId status isApproved"
    );

    res.status(200).json({
      message: "Getting agent by geofence",
      data: searchResults,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  addAgentByAdminController,
  editAgentByAdminController,
  getSingleAgentController,
  approveAgentRegistrationController,
  rejectAgentRegistrationController,
  getRatingsByCustomerController,
  getAgentByVehicleTypeController,
  getAgentByGeofenceController,
};
