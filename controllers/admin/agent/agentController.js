const { createTransport } = require("nodemailer");
const mongoose = require("mongoose");
const csvWriter = require("csv-writer").createObjectCsvWriter;
const path = require("path");
const { validationResult } = require("express-validator");
const { isValidObjectId } = require("mongoose");

const appError = require("../../../utils/appError");
const {
  uploadToFirebase,
  deleteFromFirebase,
} = require("../../../utils/imageOperation");

const Agent = require("../../../models/Agent");
const AccountLogs = require("../../../models/AccountLogs");
const { formatDate } = require("../../../utils/formatters");
const { formatToHours } = require("../../../utils/agentAppHelpers");
const AgentPricing = require("../../../models/AgentPricing");

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

const getAllAgentsController = async (req, res, next) => {
  try {
    // Get page and limit from query parameters with default values
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Fetch agents with pagination
    const allAgents = await Agent.find({ isBlocked: false })
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

    // Send email with message
    const message = `We're sorry to inform you that your registration on My Famto was rejected.`;

    // Set up nodemailer transport
    const transporter = createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    await transporter.sendMail({
      to: agentFound.email,
      subject: "Registration rejection",
      text: message,
    });

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

    if (status && status.trim().toLowerCase() !== "all") {
      filterCriteria.status = status;
    }

    if (vehicleType && vehicleType.trim().toLowerCase() !== "all") {
      filterCriteria["vehicleDetail.type"] = {
        $regex: vehicleType.trim(),
        $options: "i",
      };
    }

    if (geofence && geofence.trim().toLowerCase !== "all") {
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

const getDeliveryAgentPayoutController = async (req, res, next) => {
  try {
    // Get page and limit from query parameters with default values
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Fetch agents who are approved with pagination
    const payoutOfAllAgents = await Agent.find({
      isApproved: "Approved",
    })
      .select(
        "fullName phoneNumber appDetailHistory workStructure.cashInHand workStructure.salaryStructureId"
      )
      .skip(skip)
      .limit(limit)
      .lean(); // Convert MongoDB documents to plain JavaScript objects

    // Format the response data
    const formattedResponse = await Promise.all(
      payoutOfAllAgents
        .filter((agent) => agent.appDetailHistory.length >= 1)
        .map(async (agent) => {
          const historyLength = agent.appDetailHistory.length;
          const lastHistory = agent.appDetailHistory[historyLength - 1] || {
            details: {},
          };

          let calculatedPayment = 0; // Initialize calculatedPayment

          // Calculate payment based on certain conditions
          const agentPricing = await AgentPricing.findById(
            agent.workStructure.salaryStructureId
          );

          const loginHours = agentPricing.minLoginHours * 60 * 60 * 1000;

          if (
            lastHistory?.details?.orders >= agentPricing.minOrderNumber &&
            lastHistory?.details?.loginDuration >= loginHours
          ) {
            if (
              agentPricing &&
              lastHistory?.details?.totalEarning < agentPricing.baseFare
            ) {
              const balanceAmount =
                agentPricing.baseFare - lastHistory?.details?.totalEarning;

              // Add balance amount to calculatedPayment
              calculatedPayment += balanceAmount;
            }
          }

          // Deduct cashInHand from calculatedPayment
          const cashInHand = agent?.workStructure?.cashInHand || 0;
          calculatedPayment -= cashInHand;

          // Return the formatted response regardless of orders
          return {
            _id: agent?._id,
            fullName: agent?.fullName,
            phoneNumber: agent?.phoneNumber,
            workedDate: lastHistory?.date ? formatDate(lastHistory?.date) : "-",
            orders: lastHistory?.details?.orders || 0,
            cancelledOrders: lastHistory?.details?.cancelledOrders || 0,
            totalDistance: lastHistory?.details?.totalDistance || 0,
            loginHours: lastHistory?.details?.loginDuration
              ? formatToHours(lastHistory?.details?.loginDuration)
              : "0:00 hr",
            cashInHand,
            totalEarnings: lastHistory?.details?.totalEarning || 0,
            calculatedPayment,
            paymentSettled: lastHistory?.details?.paymentSettled,
            detailId: lastHistory?._id,
          };
        })
    );

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
    const agents = await Agent.find({
      _id: { $regex: agentId, $options: "i" },
      isApproved: "Approved",
    })
      .select(
        "fullName phoneNumber appDetailHistory workStructure.cashInHand workStructure.salaryStructureId"
      )
      .exec();

    // Filter agents that have at least one valid workedDate
    const validAgents = agents?.filter((agent) =>
      agent.appDetailHistory.some((history) => history.date)
    );

    // Process each agent to find the most recent appDetailHistory
    const formattedResponse = await Promise.all(
      validAgents
        .filter((agent) => agent.appDetailHistory.length >= 1)
        .map(async (agent) => {
          // Ensure appDetailHistory exists before sorting
          const latestHistory = agent.appDetailHistory
            ?.filter((history) => history.date) // Filter histories with a valid date
            .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

          const agentPricing = await AgentPricing.findById(
            agent.workStructure.salaryStructureId
          );

          if (!agentPricing) {
            return next(appError("Agent pricing not found", 400));
          }

          let calculatedEarning = latestHistory?.details.totalEarning;
          if (agentPricing) {
            const loginHours = agentPricing.minLoginHours * 60 * 60 * 1000;

            if (
              latestHistory?.details?.orders >= agentPricing.minOrderNumber &&
              latestHistory?.details?.loginDuration >= loginHours
            ) {
              if (latestHistory?.details.totalEarning < agentPricing.baseFare) {
                const currentEarning = latestHistory?.details.totalEarning;
                const remainingAmount = agentPricing.baseFare - currentEarning;

                calculatedEarning += remainingAmount;
              }
            }
          }

          if (agent.workStructure.cashInHand) {
            calculatedEarning -= agent.workStructure.cashInHand;
          }

          return {
            _id: agent?._id || "-",
            fullName: agent?.fullName || "-",
            phoneNumber: agent?.phoneNumber || "-",
            workedDate: latestHistory?.date
              ? formatDate(latestHistory?.date)
              : "-",
            orders: latestHistory?.details.orders || 0,
            cancelledOrders: latestHistory?.details?.cancelledOrders || 0,
            totalDistance: latestHistory?.details?.totalDistance || 0,
            loginHours: latestHistory?.details?.loginDuration
              ? formatToHours(latestHistory?.details?.loginDuration)
              : "0:00 hr",
            cashInHand: agent?.workStructure?.cashInHand || 0,
            totalEarnings: latestHistory?.details?.totalEarning || 0,
            calculatedPayment: calculatedEarning,
            paymentSettled: latestHistory?.details?.paymentSettled,
            detailId: latestHistory?._id,
          };
        })
    );

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

    // Initialize filter criteria
    const filterCriteria = { isApproved: "Approved" };

    // Check if at least one filter is provided
    if (!paymentStatus && !agentId && !geofence && !date) {
      return next(appError("At least one filter is required", 400));
    }

    // Filter by payment status, but skip if "all" is selected
    // Filter by geofence, skip if "all" is selected
    if (geofence && geofence.trim().toLowerCase() !== "all") {
      filterCriteria["geofenceId"] = geofence;
    }

    // Filter by date range, using the provided date (removing time portion)
    let startDate;
    let endDate;
    const convertToIST = (date) => {
      // Convert the date to IST by adding 5 hours 30 minutes
      const istOffset = 5 * 60 + 30; // IST is UTC + 5 hours 30 minutes
      const dateInIST = new Date(date.getTime() + istOffset * 60 * 1000);
      return dateInIST;
    };
    if (date) {
      startDate = new Date(date);
      endDate = new Date(date);
      startDate = convertToIST(startDate);
      endDate = convertToIST(endDate);

      // Set startDate to 12:00 AM IST
      startDate.setHours(0, 0, 0, 0);

      // Set endDate to 11:59 PM IST
      endDate.setHours(23, 59, 59, 999); // End of the day
    }

    // Filter by agent ID, skip if "all" is selected
    if (agentId && agentId.trim().toLowerCase() !== "all") {
      filterCriteria["_id"] = agentId;
    }

    // Fetch agents from the database based on the constructed filter criteria
    const agents = await Agent.find(filterCriteria).select(
      "fullName phoneNumber appDetailHistory workStructure.cashInHand workStructure.salaryStructureId bankDetail"
    );

    // Prepare the response structure
    const responseData = await Promise.all(
      agents.map(async (agent) => {
        // Fetch the agent's pricing details
        const agentPricing = await AgentPricing.findById(
          agent.workStructure.salaryStructureId
        );
        const loginHours = agentPricing.minLoginHours * 60 * 60 * 1000;

        // Initialize the base fare (assuming it exists in `agentPricing.baseFare`)
        const baseFare = agentPricing ? agentPricing.baseFare : 0;
        // Filter and format the appDetailHistory
        const filteredHistory = await Promise.all(
          agent.appDetailHistory
            .filter((history) => {
              const historyDate = new Date(history.date);
              const isWithinDateRange =
                historyDate >= startDate && historyDate <= endDate;

              // Filter by payment status
              let isPaymentStatusMatch = true;
              if (
                paymentStatus &&
                paymentStatus.trim().toLowerCase() !== "all"
              ) {
                const paymentSettled = history.details?.paymentSettled; // Assuming this is the correct field
                const paymentStatusBoolean =
                  paymentStatus.trim().toLowerCase() === "true";
                isPaymentStatusMatch = paymentSettled === paymentStatusBoolean;
              }

              // Return true only if both date range and payment status match
              return isWithinDateRange && isPaymentStatusMatch;
            })
            .map((history) => {
              const { totalEarning, orders, loginDuration } = history.details;

              let updatedEarning = totalEarning;
              let extraAmount = 0;

              // Check if the agent completed at least 6 orders and logged in for 360,000 milliseconds (6 minutes)
              if (
                orders >= agentPricing.minOrderNumber &&
                loginDuration >= loginHours
              ) {
                // Calculate the difference to the base fare
                if (totalEarning < baseFare) {
                  extraAmount = baseFare - totalEarning;
                  updatedEarning = baseFare; // Add the extra amount to reach the base fare
                }
              }

              return {
                date: formatDate(history.date),
                details: {
                  detailId: history._id,
                  totalEarning: updatedEarning || 0,
                  orders: orders || 0,
                  pendingOrder: history.details.pendingOrder || 0,
                  totalDistance: history.details.totalDistance || 0,
                  cancelledOrders: history.details.cancelledOrders || 0,
                  loginDuration: history.details.loginDuration || "-",
                  paymentSettled: history.details.paymentSettled,
                  extraAmount,
                  agentId: agent?._id || "-", // Store the extra amount required to reach base fare
                },
              };
            })
        );
        // Calculate `calculatedEarning` by subtracting cashInHand from totalEarning
        const totalEarning = filteredHistory.reduce(
          (acc, history) => acc + history.details.totalEarning,
          0
        );
        const calculatedEarning = totalEarning - agent.workStructure.cashInHand;

        return {
          _id: agent?._id || "-",
          fullName: agent?.fullName || "-",
          phoneNumber: agent?.phoneNumber || "-",
          workedDate: filteredHistory[0]?.date
            ? formatDate(filteredHistory[0]?.date)
            : "-",
          orders: filteredHistory[0]?.details?.orders || 0,
          cancelledOrders: filteredHistory[0]?.details?.cancelledOrders || 0,
          totalDistance: filteredHistory[0]?.details?.totalDistance || 0,
          loginHours: filteredHistory[0]?.details?.loginDuration
            ? formatToHours(filteredHistory[0]?.details?.loginDuration)
            : "0:00 hr",
          cashInHand: agent?.workStructure?.cashInHand || 0,
          totalEarnings: filteredHistory[0]?.details?.totalEarning || 0,
          calculatedPayment: calculatedEarning,
          paymentSettled: filteredHistory[0]?.details?.paymentSettled,
          detailId: filteredHistory[0]?.details?.detailId,
        };
      })
    );

    const data = responseData.filter((resp) => {
      let isWithinDateRange = true;
      if (resp.workedDate === "-") {
        isWithinDateRange = false;
      }

      // Filter by payment status
      let isPaymentStatusMatch = true;
      if (paymentStatus && paymentStatus.trim().toLowerCase() !== "all") {
        const paymentSettled = resp?.paymentSettled; // Assuming this is the correct field
        const paymentStatusBoolean =
          paymentStatus.trim().toLowerCase() === "true";
        isPaymentStatusMatch = paymentSettled === paymentStatusBoolean;
      }

      // Return true only if both date range and payment status match
      return isWithinDateRange && isPaymentStatusMatch;
    });

    // Send the response with the filtered and formatted agent data
    res.status(200).json({
      message: "Agent payout filter",
      data: data,
    });
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

const downloadAgentCSVController = async (req, res, next) => {
  try {
    const { geofenceFilter, statusFilter, vehicleTypeFilter, searchFilter } =
      req.query;

    // Build query object based on filters
    const filter = {};
    if (geofenceFilter && geofenceFilter !== "All")
      filter.geofenceId = geofenceFilter?.trim();
    if (statusFilter && statusFilter !== "All")
      filter.status = statusFilter?.trim();
    if (searchFilter) {
      filter.$or = [{ fullName: { $regex: searchFilter, $options: "i" } }];
    }
    if (vehicleTypeFilter) {
      filter["vehicleDetail.type"] = {
        $regex: vehicleTypeFilter?.trim(),
        $options: "i",
      };
    }

    // Fetch the data based on filter (get both approved and pending agents)
    let allAgents = await Agent.find(filter)
      .populate("geofenceId", "name")
      .populate("workStructure.managerId", "name")
      .populate("workStructure.salaryStructureId", "ruleName")
      .sort({ createdAt: -1 })
      .exec();

    let formattedResponse = [];

    // Collect all agents in one array
    allAgents?.forEach((agent) => {
      agent?.vehicleDetail?.forEach((vehicle) => {
        formattedResponse.push({
          agentId: agent?._id || "-",
          agentName: agent?.fullName || "-",
          agentEmail: agent?.email || "-",
          agentPhoneNumber: agent?.phoneNumber || "-",
          geofence: agent?.geofenceId?.name || "-",
          registrationStatus: agent?.isApproved || "-", // Keep both "Approved" and "Pending"
          aadharNumber: agent?.governmentCertificateDetail?.aadharNumber || "-",
          drivingLicenseNumber:
            agent?.governmentCertificateDetail?.drivingLicenseNumber || "-",
          accountHolderName: agent?.bankDetail?.accountHolderName || "-",
          accountNumber: agent?.bankDetail?.accountNumber || "-",
          IFSCCode: agent?.bankDetail?.IFSCCode || "-",
          UPIId: agent?.bankDetail?.UPIId || "-",
          manager: agent?.workStructure?.managerId?.name || "-",
          salaryStructure:
            agent?.workStructure?.salaryStructureId?.ruleName || "-",
          tag: agent?.workStructure?.tag || "-",
          cashInHand: agent?.workStructure?.cashInHand || "-",
          vehicleModel: vehicle?.model || "-",
          vehicleStatus: vehicle?.vehicleStatus ? "True" : "False",
          vehicleType: vehicle?.type || "-",
          licensePlate: vehicle?.licensePlate || "-",
        });
      });
    });

    const filePath = path.join(__dirname, "../../../sample_CSV/Agent_Data.csv");

    const csvHeaders = [
      { id: "agentId", title: "Agent ID" },
      { id: "agentName", title: "Agent name" },
      { id: "agentEmail", title: "Email" },
      { id: "agentPhoneNumber", title: "Phone number" },
      { id: "geofence", title: "Geofence" },
      { id: "registrationStatus", title: "Registration status" }, // Both "Approved" and "Pending"
      { id: "aadharNumber", title: "Aadhar number" },
      { id: "drivingLicenseNumber", title: "Driving license number" },
      { id: "accountHolderName", title: "Account holder name" },
      { id: "accountNumber", title: "Account number" },
      { id: "IFSCCode", title: "IFSC code" },
      { id: "UPIId", title: "UPI ID" },
      { id: "manager", title: "Manager" },
      { id: "salaryStructure", title: "Salary structure" },
      { id: "tag", title: "Tag" },
      { id: "cashInHand", title: "Cash in hand" },
      { id: "vehicleModel", title: "Vehicle model" },
      { id: "vehicleStatus", title: "Vehicle status" },
      { id: "vehicleType", title: "Vehicle type" },
      { id: "licensePlate", title: "License plate" },
    ];

    const writer = csvWriter({
      path: filePath,
      header: csvHeaders,
    });

    await writer.writeRecords(formattedResponse);

    res.status(200).download(filePath, "Agent_Data.csv", (err) => {
      if (err) {
        next(err);
      }
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const downloadAgentPaymentCSVController = async (req, res, next) => {
  try {
    const { paymentStatus, agent, search, date, geofence } = req.query;

    // Build query object based on filters
    const filter = { isApproved: "Approved" };

    // If agent is not 'All', apply filter for agent ID
    if (agent && agent.trim().toLowerCase() !== "all") filter["_id"] = agent;

    if (geofence && geofence.trim().toLowerCase() !== "all")
      filter["geofenceId"] = geofence?.trim();

    if (search) {
      filter.$or = [{ _id: { $regex: search, $options: "i" } }];
    }

    let startDate;
    let endDate;
    const convertToIST = (date) => {
      // Convert the date to IST by adding 5 hours 30 minutes
      const istOffset = 5 * 60 + 30; // IST is UTC + 5 hours 30 minutes
      const dateInIST = new Date(date.getTime() + istOffset * 60 * 1000);
      return dateInIST;
    };
    if (date) {
      startDate = new Date(date);
      endDate = new Date(date);
      startDate = convertToIST(startDate);
      endDate = convertToIST(endDate);

      // Set startDate to 12:00 AM IST
      startDate.setHours(0, 0, 0, 0);

      // Set endDate to 11:59 PM IST
      endDate.setHours(23, 59, 59, 999); // End of the day
    }

    // Fetch agents based on filters
    let allAgents = await Agent.find(filter)
      .select(
        "fullName phoneNumber appDetailHistory workStructure.cashInHand workStructure.salaryStructureId bankDetail"
      )
      .populate("geofenceId", "name")
      .populate("workStructure.salaryStructureId")
      .sort({ createdAt: -1 })
      .lean();

    const responseData = await Promise.all(
      allAgents.map(async (agent) => {
        // Fetch the agent's pricing details
        const agentPricing = await AgentPricing.findById(
          agent.workStructure.salaryStructureId
        );
        const loginHours = agentPricing.minLoginHours * 60 * 60 * 1000;

        // Initialize the base fare (assuming it exists in `agentPricing.baseFare`)
        const baseFare = agentPricing ? agentPricing.baseFare : 0;
        const filteredHistory = await Promise.all(
          agent.appDetailHistory
            .filter((history) => {
              const historyDate = new Date(history.date);
              const isWithinDateRange =
                historyDate >= startDate && historyDate <= endDate;

              // Filter by payment status
              let isPaymentStatusMatch = true;
              if (
                paymentStatus &&
                paymentStatus.trim().toLowerCase() !== "all"
              ) {
                const paymentSettled = history.details?.paymentSettled; // Assuming this is the correct field
                const paymentStatusBoolean =
                  paymentStatus.trim().toLowerCase() === "true";
                isPaymentStatusMatch = paymentSettled === paymentStatusBoolean;
              }

              // Return true only if both date range and payment status match
              return isWithinDateRange && isPaymentStatusMatch;
            })
            .map((history) => {
              const { totalEarning, orders, loginDuration } = history.details;

              let updatedEarning = totalEarning;
              let extraAmount = 0;

              // Check if the agent completed at least 6 orders and logged in for 360,000 milliseconds (6 minutes)
              if (
                orders >= agentPricing.minOrderNumber &&
                loginDuration >= loginHours
              ) {
                // Calculate the difference to the base fare
                if (totalEarning < baseFare) {
                  extraAmount = baseFare - totalEarning;
                  updatedEarning = baseFare; // Add the extra amount to reach the base fare
                }
              }

              return {
                date: formatDate(history.date),
                details: {
                  detailId: history._id,
                  totalEarning: updatedEarning || 0,
                  orders: orders || 0,
                  pendingOrder: history.details.pendingOrder || 0,
                  totalDistance: history.details.totalDistance || 0,
                  cancelledOrders: history.details.cancelledOrders || 0,
                  loginDuration: history.details.loginDuration || "-",
                  paymentSettled: history.details.paymentSettled,
                  extraAmount,
                  agentId: agent?._id || "-", // Store the extra amount required to reach base fare
                },
              };
            })
        );
        // Calculate `calculatedEarning` by subtracting cashInHand from totalEarning
        const totalEarning = filteredHistory.reduce(
          (acc, history) => acc + history.details.totalEarning,
          0
        );
        const calculatedEarning = totalEarning - agent.workStructure.cashInHand;

        return {
          _id: agent?._id || "-",
          fullName: agent?.fullName || "-",
          phoneNumber: agent?.phoneNumber || "-",
          workedDate: filteredHistory[0]?.date
            ? formatDate(filteredHistory[0]?.date)
            : "-",
          orders: filteredHistory[0]?.details?.orders || 0,
          cancelledOrders: filteredHistory[0]?.details?.cancelledOrders || 0,
          totalDistance: filteredHistory[0]?.details?.totalDistance || 0,
          loginHours: filteredHistory[0]?.details?.loginDuration
            ? formatToHours(filteredHistory[0]?.details?.loginDuration)
            : "0:00 hr",
          cashInHand: agent?.workStructure?.cashInHand || 0,
          totalEarnings: filteredHistory[0]?.details?.totalEarning || 0,
          calculatedPayment: calculatedEarning,
          paymentSettled: filteredHistory[0]?.details?.paymentSettled,
          detailId: filteredHistory[0]?.details?.detailId,
          accountHolderName: agent?.bankDetail?.accountHolderName,
          accountNumber: agent?.bankDetail?.accountNumber,
          IFSCCode: agent?.bankDetail?.IFSCCode,
          UPIId: agent?.bankDetail?.UPIId,
          geofence: agent?.geofenceId?.name,
        };
      })
    );

    const data = responseData.filter((resp) => {
      let isWithinDateRange = true;
      if (resp.workedDate === "-") {
        isWithinDateRange = false;
      }

      // Filter by payment status
      let isPaymentStatusMatch = true;
      if (paymentStatus && paymentStatus.trim().toLowerCase() !== "all") {
        const paymentSettled = resp?.paymentSettled; // Assuming this is the correct field
        const paymentStatusBoolean =
          paymentStatus.trim().toLowerCase() === "true";
        isPaymentStatusMatch = paymentSettled === paymentStatusBoolean;
      }

      // Return true only if both date range and payment status match
      return isWithinDateRange && isPaymentStatusMatch;
    });

    // Define file path for CSV
    const filePath = path.join(__dirname, "../../../sample_CSV/sample_CSV.csv");

    // Define CSV headers
    const csvHeaders = [
      { id: "_id", title: "Agent ID" },
      { id: "fullName", title: "Full Name" },
      { id: "phoneNumber", title: "Phone Number" },
      { id: "workedDate", title: "Worked Date" },
      { id: "orders", title: "Orders" },
      { id: "cancelledOrders", title: "Cancelled Orders" }, // Add calculatedPayment to CSV headers
      { id: "totalDistance", title: "Total Distance" },
      { id: "loginHours", title: "Login Hours" },
      { id: "cashInHand", title: "Cash In Hand" },
      { id: "totalEarnings", title: "Total Earnings" },
      { id: "calculatedPayment", title: "Calculated Payment" },
      { id: "paymentSettled", title: "Payment Settled" },
      { id: "accountHolderName", title: "Account Holder Name" },
      { id: "accountNumber", title: "Account Number" },
      { id: "IFSCCode", title: "IFSC Code" },
      { id: "UPIId", title: "UPI Id" },
      { id: "geofence", title: "Geofence" },
    ];

    // Create CSV writer
    const writer = csvWriter({
      path: filePath,
      header: csvHeaders,
    });

    // Write records to CSV
    await writer.writeRecords(data);

    // Send the CSV file to the client
    res.status(200).download(filePath, "Agent_Payments.csv", (err) => {
      if (err) {
        next(err);
      }
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
  downloadAgentCSVController,
  downloadAgentPaymentCSVController,
};
