const { validationResult } = require("express-validator");
const appError = require("../../../utils/appError");
const {
  uploadToFirebase,
  deleteFromFirebase,
} = require("../../../utils/imageOperation");
const Agent = require("../../../models/Agent");
const { default: mongoose } = require("mongoose");
const AccountLogs = require("../../../models/AccountLogs");

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
      geofenceId,
      agentImageURL,
      workStructure: {
        managerId,
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
      .populate("workStructure.managerId", "name")
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

const getAllAgentsController = async (req, res, next) => {
  try {
    const allAgents = await Agent.find({})
      .populate("geofenceId", "name")
      .populate("workStructure.managerId", "name")
      .select(
        "fullName email phoneNumber location isApproved geofenceId status workStructure"
      );

    const formattedResponse = allAgents.map((agent) => {
      return {
        _id: agent._id,
        fullName: agent.fullName,
        email: agent.email,
        phoneNumber: agent.phoneNumber,
        isApproved: agent.isApproved,
        geofence: agent?.geofenceId?.name || "N/A",
        status: agent.status === "Inactive" ? false : true,
        manager: agent?.workStructure?.managerId?.name || "N/A",
      };
    });

    res.status(200).json({
      message: "All agents",
      data: formattedResponse,
    });
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
      message: "Agent registration approved",
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

const filterAgentsController = async (req, res, next) => {
  try {
    const { vehicleType, geofence, status } = req.query;

    if (!vehicleType && !geofence) {
      return res
        .status(400)
        .json({ message: "Vehicle type or geofence is required" });
    }

    const filterCriteria = {};

    if (status) {
      filterCriteria.status = { $regex: status.trim(), $options: "i" };
    }

    if (vehicleType) {
      filterCriteria["vehicleDetail.type"] = {
        $regex: vehicleType.trim(),
        $options: "i",
      };
    }

    if (geofence) {
      try {
        const geofenceObjectId = new mongoose.Types.ObjectId(geofence.trim());
        filterCriteria.geofenceId = geofenceObjectId;
      } catch (err) {
        return res.status(400).json({ message: "Invalid geofence ID" });
      }
    }

    const searchResults = await Agent.find(
      filterCriteria,
      "_id fullName email phoneNumber manager geofence status isApproved"
    );

    res.status(200).json({
      message: "Getting agents",
      data: searchResults,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const blockAgentController = async (req, res, next) => {
  const { reason } = req.body;
  try {
    const agentFound = await Agent.findById(req.params.agentId);

    if (!agentFound) {
      return next(appError("Agent not found", 404));
    }

    agentFound.isBlocked = true;
    agentFound.reasonForBlockingOrDeleting = reason;
    agentFound.blockedDate = new Date();

    await agentFound.save();
    const accountLogs = await new AccountLogs({
      _id: agentFound._id,
      fullName: agentFound.fullName,
      role: agentFound.role,
      description: reason,
    });
    await accountLogs.save();

    res.status(200).json({ message: "Agent blocked successfully" });
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
  filterAgentsController,
  blockAgentController,
  getAllAgentsController,
};
