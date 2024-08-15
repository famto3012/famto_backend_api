const { validationResult } = require("express-validator");
const appError = require("../../../utils/appError");
const {
  uploadToFirebase,
  deleteFromFirebase,
} = require("../../../utils/imageOperation");
const Agent = require("../../../models/Agent");
const mongoose = require("mongoose");
const AccountLogs = require("../../../models/AccountLogs");
const { formatDate } = require("../../../utils/formatters");
const { formatToHours } = require("../../../utils/agentAppHelpers");

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
        agentImageURL = await uploadToFirebase(agentImage[0], "AgentImages");
      }
    }

    const newAgent = await Agent.create({
      fullName,
      phoneNumber,
      email,
      geofenceId,
      agentImageURL,
      workStructure: {
        // managerId: managerId || null,
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
    email,
    phoneNumber,
    geofenceId,
    vehicleDetail,
    governmentCertificateDetail,
    bankDetail,
    workStructure,
  } = req.body;

  console.log("workStructure", workStructure);

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

    let {
      rcFrontImageURL = agentFound?.vehicleDetail[0]?.rcFrontImageURL,
      rcBackImageURL = agentFound?.vehicleDetail[0]?.rcBackImageURL,
      aadharFrontImageURL = agentFound?.governmentCertificateDetail
        ?.aadharFrontImageURL,
      aadharBackImageURL = agentFound?.governmentCertificateDetail
        ?.aadharBackImageURL,
      drivingLicenseFrontImageURL = agentFound?.governmentCertificateDetail
        ?.drivingLicenseFrontImageURL,
      drivingLicenseBackImageURL = agentFound?.governmentCertificateDetail
        ?.drivingLicenseBackImageURL,
      agentImageURL = agentFound?.agentImageURL,
    } = {};

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

      const fileOperations = [
        {
          file: rcFrontImage,
          url: rcFrontImageURL,
          type: "RCImages",
          setUrl: (url) => (rcFrontImageURL = url),
        },
        {
          file: rcBackImage,
          url: rcBackImageURL,
          type: "RCImages",
          setUrl: (url) => (rcBackImageURL = url),
        },
        {
          file: aadharFrontImage,
          url: aadharFrontImageURL,
          type: "AadharImages",
          setUrl: (url) => (aadharFrontImageURL = url),
        },
        {
          file: aadharBackImage,
          url: aadharBackImageURL,
          type: "AadharImages",
          setUrl: (url) => (aadharBackImageURL = url),
        },
        {
          file: drivingLicenseFrontImage,
          url: drivingLicenseFrontImageURL,
          type: "DrivingLicenseImages",
          setUrl: (url) => (drivingLicenseFrontImageURL = url),
        },
        {
          file: drivingLicenseBackImage,
          url: drivingLicenseBackImageURL,
          type: "DrivingLicenseImages",
          setUrl: (url) => (drivingLicenseBackImageURL = url),
        },
        {
          file: agentImage,
          url: agentImageURL,
          type: "AgentImages",
          setUrl: (url) => (agentImageURL = url),
        },
      ];

      for (const { file, url, type, setUrl } of fileOperations) {
        if (file) {
          if (url) {
            await deleteFromFirebase(url);
          }
          setUrl(await uploadToFirebase(file[0], type));
        }
      }
    }

    // Handle updating or adding to vehicleDetail
    let updatedVehicleDetail = agentFound.vehicleDetail;
    if (updatedVehicleDetail.length > 0) {
      updatedVehicleDetail[0] = {
        ...updatedVehicleDetail[0],
        ...vehicleDetail[0],
        rcFrontImageURL,
        rcBackImageURL,
      };
    } else {
      updatedVehicleDetail.push({
        ...vehicleDetail[0],
        rcFrontImageURL,
        rcBackImageURL,
      });
    }

    const updatedAgent = await Agent.findByIdAndUpdate(
      req.params.agentId,
      {
        fullName,
        phoneNumber,
        email,
        geofenceId: geofenceId._id,
        agentImageURL,
        workStructure: {
          ...workStructure,
        },
        bankDetail: {
          ...bankDetail,
        },
        governmentCertificateDetail: {
          ...governmentCertificateDetail,
          aadharFrontImageURL,
          aadharBackImageURL,
          drivingLicenseFrontImageURL,
          drivingLicenseBackImageURL,
        },
        vehicleDetail: updatedVehicleDetail,
      },
      { new: true }
    );

    if (!updatedAgent) {
      return next(appError("Error in editing agent"));
    }

    res.status(200).json({
      message: "Updated agent by admin",
      data: updatedAgent,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getSingleAgentController = async (req, res, next) => {
  try {
    const { agentId } = req.params;

    const agentFound = await Agent.findById(agentId)
      .populate("geofenceId", "name")
      .populate("workStructure.managerId", "name")
      .populate("workStructure.salaryStructureId", "ruleName")
      .select(
        "-ratingsByCustomers -appDetail -appDetailHistory -agentTransaction -location -role -taskCompleted -isBlocked -reasonForBlockingOrDeleting -blockedDate -loginStartTime -loginEndTime"
      );

    if (!agentFound) {
      return next(appError("Agent not found", 404));
    }

    agentFound.status = agentFound.status === "Inactive" ? false : true;

    let vehicleDetail = {};
    if (agentFound.vehicleDetail && agentFound.vehicleDetail.length > 0) {
      vehicleDetail = agentFound.vehicleDetail[0];
    }

    agentFound.vehicleDetail = vehicleDetail;

    res.status(200).json({
      message: "Single agent detail",
      data: {
        ...agentFound.toObject(),
        status: Boolean(agentFound.status),
      },
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// const getAllAgentsController = async (req, res, next) => {
//   try {
//     const allAgents = await Agent.find({})
//       .populate("geofenceId", "name")
//       .populate("workStructure.managerId", "name")
//       .select(
//         "fullName email phoneNumber location isApproved geofenceId status workStructure"
//       );

//     const formattedResponse = allAgents.map((agent) => {
//       return {
//         _id: agent._id,
//         fullName: agent.fullName,
//         email: agent.email,
//         phoneNumber: agent.phoneNumber,
//         isApproved: agent.isApproved,
//         geofence: agent?.geofenceId?.name || "-",
//         status: agent.status === "Inactive" ? false : true,
//         manager: agent?.workStructure?.managerId?.name || "-",
//         location: agent.location,
//       };
//     });

//     res.status(200).json({
//       message: "All agents",
//       data: formattedResponse,
//     });
//   } catch (err) {
//     next(appError(err.message));
//   }
// };

const getAllAgentsController = async (req, res, next) => {
  try {
    // Get page and limit from query parameters with default values
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Fetch agents with pagination
    const allAgents = await Agent.find({})
      .populate("geofenceId", "name")
      .populate("workStructure.managerId", "name")
      .select(
        "fullName email phoneNumber location isApproved geofenceId status workStructure"
      )
      .sort({ createdAt: -1 }) // Assuming agents have a createdAt field for sorting
      .skip(skip)
      .limit(limit)
      .lean(); // Convert MongoDB documents to plain JavaScript objects

    // Format the response data
    const formattedResponse = allAgents.map((agent) => ({
      _id: agent._id,
      fullName: agent.fullName,
      email: agent.email,
      phoneNumber: agent.phoneNumber,
      isApproved: agent.isApproved,
      geofence: agent?.geofenceId?.name || "-",
      status: agent.status !== "Inactive", // True for Active, False for Inactive
      manager: agent?.workStructure?.managerId?.name || "-",
      location: agent.location,
    }));

    // Count total documents
    const totalDocuments = await Agent.countDocuments({});

    // Calculate total pages
    const totalPages = Math.ceil(totalDocuments / limit);

    // Prepare pagination details
    const pagination = {
      totalDocuments,
      totalPages,
      currentPage: page,
      pageSize: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };

    // Send the response with the formatted data and pagination
    res.status(200).json({
      message: "All agents retrieved successfully",
      data: formattedResponse,
      pagination,
    });
  } catch (err) {
    next(appError(err.message));
  }
};


const searchAgentByNameController = async (req, res, next) => {
  try {
    const { query } = req.query;

    if (!query || query.trim() === "") {
      return next(appError("query is required"));
    }

    const allAgents = await Agent.find({
      fullName: { $regex: query.trim(), $options: "i" },
    })
      .populate("geofenceId", "name")
      .populate("workStructure.managerId", "name")
      .select(
        "fullName email phoneNumber location isApproved geofenceId status workStructure"
      );

    const formattedResponse = allAgents?.map((agent) => {
      return {
        _id: agent._id,
        fullName: agent.fullName,
        email: agent.email,
        phoneNumber: agent.phoneNumber,
        isApproved: agent.isApproved,
        geofence: agent?.geofenceId?.name || "-",
        status: agent.status === "Inactive" ? false : true,
        manager: agent?.workStructure?.managerId?.name || "-",
      };
    });

    res.status(200).json({
      message: "Search results",
      data: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const changeAgentStatusController = async (req, res, next) => {
  try {
    const { agentId } = req.params;

    const agentFound = await Agent.findById(agentId);

    if (!agentFound) {
      return next(appError("Agent not found", 404));
    }

    if (agentFound.status === "Free" || agentFound.status === "Busy") {
      agentFound.status = "Inactive";
    } else {
      agentFound.status = "Free";
    }

    await agentFound.save();

    let status;
    if (agentFound.status === "Free") {
      status = true;
    } else {
      status = false;
    }

    res.status(200).json({
      message: "Agent status changed",
      data: status,
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
      "_id fullName email phoneNumber workStructure geofenceId status isApproved"
    )
      .populate("workStructure.managerId", "name")
      .populate("geofenceId", "name");

    const formattedResponse = searchResults.map((agent) => {
      return {
        _id: agent._id,
        fullName: agent.fullName,
        email: agent.email,
        phoneNumber: agent.phoneNumber,
        manager: agent?.workStructure?.managerId?.name || "-",
        geofence: agent?.geofenceId?.name || "-",
        status: agent.status === "Inactive" ? false : true,
        isApproved: agent.isApproved,
      };
    });

    res.status(200).json({
      message: "Getting agents",
      data: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const blockAgentController = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const { agentId } = req.params;

    const agentFound = await Agent.findById(agentId);

    if (!agentFound) {
      return next(appError("Agent not found", 404));
    }

    agentFound.isBlocked = true;
    agentFound.reasonForBlockingOrDeleting = reason;
    agentFound.blockedDate = new Date();

    await agentFound.save();

    await AccountLogs.create({
      userId: agentId,
      fullName: agentFound.fullName,
      role: agentFound.role,
      description: reason,
    });

    // await accountLogs.save();

    res.status(200).json({ message: "Agent blocked successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

// const getDeliveryAgentPayoutController = async (req, res, next) => {
//   try {
//     const payoutOfAllAgents = await Agent.find({
//       isApproved: "Approved",
//     }).select("fullName phoneNumber appDetailHistory workStructure.cashInHand");

//     const formattedResponse = payoutOfAllAgents
//       .filter((agent) => agent.appDetailHistory.length >= 1)
//       .map((agent) => {
//         const historyLength = agent.appDetailHistory.length;
//         const lastHistory = agent.appDetailHistory[historyLength - 1] || {
//           details: {},
//         };

//         return {
//           _id: agent._id,
//           fullName: agent.fullName,
//           phoneNumber: agent.phoneNumber,
//           workedDate: lastHistory.date ? formatDate(lastHistory.date) : null,
//           orders: lastHistory.details.orders || 0,
//           cancelledOrders: lastHistory.details.cancelledOrders || 0,
//           totalDistance: lastHistory.details.totalDistance || 0,
//           loginHours: lastHistory.details.loginDuration
//             ? formatToHours(lastHistory.details.loginDuration)
//             : "0:00 hr",
//           cashInHand: agent.workStructure?.cashInHand || 0,
//           totalEarnings: lastHistory.details.totalEarning || 0,
//           paymentSettled: lastHistory.details.paymentSettled,
//           detailId: lastHistory._id,
//         };
//       });

//     res.status(200).json({
//       message: "Agent payout detail",
//       data: formattedResponse,
//     });
//   } catch (err) {
//     next(appError(err.message));
//   }
// };

const getDeliveryAgentPayoutController = async (req, res, next) => {
  try {
    // Get page and limit from query parameters with default values
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Fetch agents who are approved with pagination
    const payoutOfAllAgents = await Agent.find({
      isApproved: "Approved",
    })
      .select("fullName phoneNumber appDetailHistory workStructure.cashInHand")
      .skip(skip)
      .limit(limit)
      .lean(); // Convert MongoDB documents to plain JavaScript objects

    // Format the response data
    const formattedResponse = payoutOfAllAgents
      .filter((agent) => agent.appDetailHistory.length >= 1)
      .map((agent) => {
        const historyLength = agent.appDetailHistory.length;
        const lastHistory = agent.appDetailHistory[historyLength - 1] || {
          details: {},
        };

        return {
          _id: agent._id,
          fullName: agent.fullName,
          phoneNumber: agent.phoneNumber,
          workedDate: lastHistory.date ? formatDate(lastHistory.date) : null,
          orders: lastHistory.details.orders || 0,
          cancelledOrders: lastHistory.details.cancelledOrders || 0,
          totalDistance: lastHistory.details.totalDistance || 0,
          loginHours: lastHistory.details.loginDuration
            ? formatToHours(lastHistory.details.loginDuration)
            : "0:00 hr",
          cashInHand: agent.workStructure?.cashInHand || 0,
          totalEarnings: lastHistory.details.totalEarning || 0,
          paymentSettled: lastHistory.details.paymentSettled,
          detailId: lastHistory._id,
        };
      });

    // Count total approved agents with app detail history
    const totalDocuments = await Agent.countDocuments({
      isApproved: "Approved",
      appDetailHistory: { $exists: true, $not: { $size: 0 } },
    });

    // Calculate total pages
    const totalPages = Math.ceil(totalDocuments / limit);

    // Prepare pagination details
    const pagination = {
      totalDocuments,
      totalPages,
      currentPage: page,
      pageSize: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };

    // Send the response with the formatted data and pagination
    res.status(200).json({
      message: "Agent payout detail",
      data: formattedResponse,
      pagination,
    });
  } catch (err) {
    next(appError(err.message));
  }
};


const searchAgentInPayoutController = async (req, res, next) => {
  try {
    const { agentId } = req.query;

    // Check if agentId is provided
    if (!agentId) {
      return res.status(400).json({ message: "Agent ID is required" });
    }

    // Find agents matching the regex for agentId
    const agents = await Agent.find({ _id: { $regex: agentId, $options: "i" } })
      .select("fullName phoneNumber appDetailHistory workStructure.cashInHand")
      .exec();

    if (agents.length === 0) {
      return res.status(404).json({ message: "No agents found" });
    }

    // Filter agents that have at least one valid workedDate
    const validAgents = agents.filter((agent) =>
      agent.appDetailHistory.some((history) => history.date)
    );

    if (validAgents.length === 0) {
      return res
        .status(404)
        .json({ message: "No agents with valid workedDate found" });
    }

    // Process each agent to find the most recent appDetailHistory
    const formattedResponse = validAgents.map((agent) => {
      // Ensure appDetailHistory exists before sorting
      const latestHistory = agent.appDetailHistory
        ?.filter((history) => history.date) // Filter histories with a valid date
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

      return {
        _id: agent._id,
        fullName: agent.fullName,
        phoneNumber: agent.phoneNumber,
        workedDate: latestHistory ? formatDate(latestHistory.date) : null,
        orders: latestHistory?.details.orders || 0,
        cancelledOrders: latestHistory?.details.cancelledOrders || 0,
        totalDistance: latestHistory?.details.totalDistance || 0,
        loginHours: latestHistory?.details.loginDuration
          ? formatToHours(latestHistory.details.loginDuration)
          : "0:00 hr",
        cashInHand: agent.workStructure?.cashInHand || 0,
        totalEarnings: latestHistory?.details.totalEarning || 0,
        paymentSettled: latestHistory?.details.paymentSettled,
        detailId: latestHistory?._id,
      };
    });

    res.status(200).json({
      message: "Agent history details",
      data: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const filterAgentPayoutController = async (req, res, next) => {
  try {
    const { paymentStatus, agentId, geofence, date } = req.query;

    const filterCriteria = {};

    if (paymentStatus && paymentStatus.trim().toLowerCase() !== "all") {
      filterCriteria["appDetailHistory.details.paymentSettled"] =
        paymentStatus === "true";
    }

    if (geofence && geofence.trim().toLowerCase() !== "all") {
      try {
        const geofenceObjectId = new mongoose.Types.ObjectId(geofence.trim());
        filterCriteria.geofenceId = geofenceObjectId;
      } catch (err) {
        return res.status(400).json({ message: "Invalid geofence ID" });
      }
    }

    if (agentId && agentId.trim().toLowerCase() !== "all") {
      try {
        const agent = await Agent.findById(agentId)
          .select(
            "fullName phoneNumber appDetailHistory workStructure.cashInHand"
          )
          .exec();

        if (!agent) {
          return res.status(404).json({ message: "Agent not found" });
        }

        let filteredHistory = agent.appDetailHistory.filter((history) => {
          if (paymentStatus !== undefined) {
            return (
              history.details.paymentSettled === (paymentStatus === "true")
            );
          }
          return true;
        });

        if (date) {
          const targetDate = new Date(date);
          filteredHistory = filteredHistory.filter((history) => {
            return (
              new Date(history.date).toDateString() ===
              targetDate.toDateString()
            );
          });
        }

        const formattedResponse = filteredHistory
          .filter((history) => history.details.totalEarning > 0)
          .map((history) => ({
            _id: agent._id,
            fullName: agent.fullName,
            phoneNumber: agent.phoneNumber,
            workedDate: history.date ? formatDate(history.date) : null,
            orders: history.details.orders || 0,
            cancelledOrders: history.details.cancelledOrders || 0,
            totalDistance: history.details.totalDistance || 0,
            loginHours: history.details.loginDuration
              ? formatToHours(history.details.loginDuration)
              : "0:00 hr",
            cashInHand: agent.workStructure?.cashInHand || 0,
            totalEarnings: history.details.totalEarning || 0,
            paymentSettled: history.details.paymentSettled,
            detailId: history._id,
          }));

        return res.status(200).json({
          message: "Agent payout detail",
          data: formattedResponse,
        });
      } catch (err) {
        return res.status(400).json({ message: "Invalid agent ID" });
      }
    } else {
      const agents = await Agent.find({
        isApproved: "Approved",
        ...filterCriteria,
      })
        .select(
          "fullName phoneNumber appDetailHistory workStructure.cashInHand"
        )
        .exec();

      let formattedResponse = [];

      agents.forEach((agent) => {
        let filteredHistory = agent.appDetailHistory.filter((history) => {
          if (paymentStatus !== undefined) {
            return (
              history.details.paymentSettled === (paymentStatus === "true")
            );
          }
          return true;
        });

        if (date) {
          const targetDate = new Date(date);
          filteredHistory = filteredHistory.filter((history) => {
            return (
              new Date(history.date).toDateString() ===
              targetDate.toDateString()
            );
          });
        }

        const response = filteredHistory
          .filter((history) => history.details.totalEarning > 0)
          .map((history) => ({
            _id: agent._id,
            fullName: agent.fullName,
            phoneNumber: agent.phoneNumber,
            workedDate: history.date ? formatDate(history.date) : null,
            orders: history.details.orders || 0,
            cancelledOrders: history.details.cancelledOrders || 0,
            totalDistance: history.details.totalDistance || 0,
            loginHours: history.details.loginDuration
              ? formatToHours(history.details.loginDuration)
              : "0:00 hr",
            cashInHand: agent.workStructure?.cashInHand || 0,
            totalEarnings: history.details.totalEarning || 0,
            paymentSettled: history.details.paymentSettled,
            detailId: history._id,
          }));

        formattedResponse = formattedResponse.concat(response);
      });

      res.status(200).json({
        message: "Agent payout detail",
        data: formattedResponse,
      });
    }
  } catch (err) {
    next(appError(err.message));
  }
};

const approvePaymentController = async (req, res, next) => {
  try {
    const { agentId, detailId } = req.params;

    const agentFound = await Agent.findById(agentId);

    if (!agentFound) {
      return next(appError("Agent not found", 404));
    }

    const detailFound = agentFound?.appDetailHistory?.find((detail) => {
      return detail._id.toString() === detailId;
    });

    if (!detailFound) {
      return next(appError("History detail not found", 404));
    }

    if (detailFound.details.paymentSettled) {
      return next(appError("Payment already settled", 400));
    }

    let updatedTransaction = {
      type: "Debit",
      madeOn: new Date(),
    };

    if (agentFound?.workStructure?.cashInHand > 0) {
      agentFound.appDetail.totalEarning -= agentFound.workStructure.cashInHand;

      updatedTransaction.amount = agentFound.workStructure.cashInHand;
      agentFound.agentTransaction.push(updatedTransaction);

      agentFound.workStructure.cashInHand = 0;
    }

    detailFound.details.paymentSettled = true;

    await agentFound.save();

    res.status(200).json({
      message: "Payment approved",
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
  searchAgentByNameController,
  rejectAgentRegistrationController,
  getRatingsByCustomerController,
  filterAgentsController,
  blockAgentController,
  getAllAgentsController,
  getDeliveryAgentPayoutController,
  searchAgentInPayoutController,
  filterAgentPayoutController,
  approvePaymentController,
  changeAgentStatusController,
};
