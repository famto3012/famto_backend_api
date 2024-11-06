const { createTransport } = require("nodemailer");
const mongoose = require("mongoose");
const csvWriter = require("csv-writer").createObjectCsvWriter;
const path = require("path");
const { validationResult } = require("express-validator");

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
const ejs = require("ejs");

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

  console.log(req.body);

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
    const rejectionTemplatePath = path.join(
      __dirname,
      "../../../templates/rejectionTemplate.ejs"
    );

    const htmlContent = await ejs.renderFile(rejectionTemplatePath, {
      recipientName: agentFound.fullName,
      app: "agent",
      email: "hr@famto.in",
    });

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
      html: htmlContent,
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

    // if (!vehicleType && !geofence) {
    //   return res
    //     .status(400)
    //     .json({ message: "Vehicle type or geofence is required" });
    // }
    console.log(
      "vehicleType",
      vehicleType,
      "geofence",
      geofence,
      "status",
      status
    );
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

    if (geofence && geofence.trim().toLowerCase() !== "all") {
      try {
        const geofenceObjectId = new mongoose.Types.ObjectId(geofence.trim());
        filterCriteria.geofenceId = geofenceObjectId;
      } catch (err) {
        return res.status(400).json({ message: "Invalid geofence ID" });
      }
    }

    console.log("filterCriteria", filterCriteria);
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
    // console.log("formattedResponse", formattedResponse)
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
    // Retrieve pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Retrieve approved agents with required fields
    const agents = await Agent.find({ isApproved: "Approved" })
      .select(
        "fullName phoneNumber appDetailHistory workStructure.cashInHand workStructure.salaryStructureId"
      )
      .skip(skip)
      .limit(limit)
      .lean(); // Retrieve plain JS objects

    // Fetch all unique AgentPricing IDs
    const pricingIds = [
      ...new Set(agents.map((agent) => agent.workStructure.salaryStructureId)),
    ];
    const pricingData = await AgentPricing.find({ _id: { $in: pricingIds } })
      .select("minLoginHours minOrderNumber baseFare")
      .lean();

    // Map pricing data for quick lookup
    const pricingMap = pricingData.reduce((acc, pricing) => {
      acc[pricing._id] = pricing;
      return acc;
    }, {});

    // Format the response data
    const formattedResponse = await Promise.all(
      agents
        .filter((agent) => agent.appDetailHistory.length > 0)
        .map((agent) => {
          const { cashInHand } = agent.workStructure;
          const latestHistory = agent.appDetailHistory.at(-1);

          // Retrieve corresponding pricing details
          const agentPricing =
            pricingMap[agent.workStructure.salaryStructureId];
          if (!agentPricing)
            return next(appError("Pricing data not found", 400));

          // Calculate login hours in ms
          const requiredLoginHours =
            agentPricing.minLoginHours * 60 * 60 * 1000;
          const { orders, totalEarning, loginDuration } = latestHistory.details;

          // Determine payment amount
          let calculatedPayment = Math.max(
            0,
            agentPricing.baseFare - totalEarning
          );
          if (
            orders < agentPricing.minOrderNumber ||
            loginDuration < requiredLoginHours
          ) {
            calculatedPayment = 0; // Do not pay if criteria are not met
          }
          calculatedPayment -= cashInHand;

          return {
            agentId: agent._id,
            fullName: agent.fullName,
            phoneNumber: agent.phoneNumber,
            workedDate: latestHistory.date
              ? formatDate(latestHistory.date)
              : "-",
            orders: orders || 0,
            cancelledOrders: latestHistory.details.cancelledOrders || 0,
            totalDistance: latestHistory.details.totalDistance || 0,
            loginHours: loginDuration
              ? formatToHours(loginDuration)
              : "0:00 hr",
            cashInHand,
            totalEarnings: totalEarning,
            calculatedPayment,
            paymentSettled: latestHistory.details.paymentSettled,
            detailId: latestHistory.detailId,
          };
        })
    );

    // Get total number of approved agents with history
    const totalDocuments = formattedResponse?.length || 1;
    const totalPages = Math.ceil(totalDocuments / limit);

    // Respond with formatted data and pagination
    res.status(200).json({
      message: "Agent payout detail",
      data: formattedResponse,
      pagination: {
        totalDocuments,
        totalPages,
        currentPage: page,
        pageSize: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const searchAgentInPayoutController = async (req, res, next) => {
  try {
    const { agentId } = req.query;
    if (!agentId)
      return res.status(400).json({ message: "Agent ID is required" });

    // Find approved agents with a matching ID
    const agents = await Agent.find({
      _id: { $regex: agentId, $options: "i" },
      isApproved: "Approved",
    })
      .select(
        "fullName phoneNumber appDetailHistory workStructure.cashInHand workStructure.salaryStructureId"
      )
      .lean();

    // Filter agents with at least one entry in appDetailHistory and process each one
    const formattedResponse = await Promise.all(
      agents.map(async (agent) => {
        const latestHistory = agent.appDetailHistory
          .filter((history) => history.date)
          .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

        if (!latestHistory) return null; // Skip if no valid history found

        // Fetch agent pricing details
        const agentPricing = await AgentPricing.findById(
          agent.workStructure.salaryStructureId
        ).lean();
        if (!agentPricing) return null;

        // Calculate payment based on pricing and history details
        const {
          orders = 0,
          loginDuration = 0,
          totalEarning = 0,
        } = latestHistory.details || {};
        const loginHoursRequired = agentPricing.minLoginHours * 3600 * 1000;
        let calculatedPayment = totalEarning;

        // Adjust payment to meet base fare if conditions are met
        if (
          orders >= agentPricing.minOrderNumber &&
          loginDuration >= loginHoursRequired
        ) {
          calculatedPayment = Math.max(totalEarning, agentPricing.baseFare);
        }

        // Deduct cashInHand from calculated payment
        const cashInHand = agent.workStructure.cashInHand || 0;
        calculatedPayment -= cashInHand;

        // Format response for each agent
        return {
          agentId: agent._id,
          fullName: agent.fullName,
          phoneNumber: agent.phoneNumber,
          workedDate: latestHistory.date ? formatDate(latestHistory.date) : "-",
          orders,
          cancelledOrders: latestHistory.details?.cancelledOrders || 0,
          totalDistance: latestHistory.details?.totalDistance || 0,
          loginHours: formatToHours(loginDuration),
          cashInHand,
          totalEarnings: totalEarning,
          calculatedPayment,
          paymentSettled: latestHistory.details?.paymentSettled,
          detailId: latestHistory.detailId,
        };
      })
    );

    // Remove any null entries from the response array in case any pricing or history was missing
    const nonNullResponses = formattedResponse.filter(Boolean);

    res.status(200).json({
      message: "Agent history details",
      data: nonNullResponses,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const filterAgentPayoutController = async (req, res, next) => {
  try {
    const { paymentStatus, agentId, geofence, date } = req.query;

    // Build filter criteria based on request parameters
    const filterCriteria = { isApproved: "Approved" };
    if (agentId && agentId.toLowerCase() !== "all")
      filterCriteria._id = agentId;
    if (geofence && geofence.toLowerCase() !== "all")
      filterCriteria.geofenceId =
        mongoose.Types.ObjectId.createFromHexString(geofence);

    const paymentStatusBool =
      paymentStatus?.toLowerCase() === "true" ? true : false;

    // Convert date filter to a start and end range in IST timezone
    const dateFilter = {};
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(18, 30, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(18, 29, 59, 999);
      dateFilter.date = { $gte: startDate, $lte: endDate };
    }

    // Use aggregation to handle filtering and calculation in the database
    const agents = await Agent.aggregate([
      { $match: filterCriteria }, // Filter based on criteria
      { $unwind: "$appDetailHistory" }, // Unwind appDetailHistory to treat each entry as a separate document
      {
        $match: {
          ...(date ? { "appDetailHistory.date": dateFilter.date } : {}),
          ...(paymentStatus
            ? { "appDetailHistory.details.paymentSettled": paymentStatusBool }
            : {}),
        },
      },
      {
        $lookup: {
          from: "agentpricings",
          localField: "workStructure.salaryStructureId",
          foreignField: "_id",
          as: "salaryStructure",
        },
      },
      { $unwind: "$salaryStructure" },
      {
        $addFields: {
          calculatedPayment: {
            $cond: {
              if: {
                $and: [
                  {
                    $gte: [
                      "$appDetailHistory.details.orders",
                      "$salaryStructure.minOrderNumber",
                    ],
                  },
                  {
                    $gte: [
                      "$appDetailHistory.details.loginDuration",
                      {
                        $multiply: ["$salaryStructure.minLoginHours", 3600000],
                      },
                    ],
                  },
                ],
              },
              then: {
                $cond: {
                  if: {
                    $lt: [
                      "$appDetailHistory.details.totalEarning",
                      "$salaryStructure.baseFare",
                    ],
                  },
                  then: {
                    $subtract: [
                      "$salaryStructure.baseFare",
                      "$workStructure.cashInHand",
                    ],
                  },
                  else: {
                    $subtract: [
                      "$appDetailHistory.details.totalEarning",
                      "$workStructure.cashInHand",
                    ],
                  },
                },
              },
              else: {
                $subtract: [
                  "$appDetailHistory.details.totalEarning",
                  "$workStructure.cashInHand",
                ],
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          fullName: 1,
          phoneNumber: 1,
          workedDate: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$appDetailHistory.date",
            },
          },
          orders: "$appDetailHistory.details.orders",
          cancelledOrders: "$appDetailHistory.details.cancelledOrders",
          totalDistance: "$appDetailHistory.details.totalDistance",
          // loginHours: {
          //   $divide: ["$appDetailHistory.details.loginDuration", 3600000],
          // },
          loginHours: "$appDetailHistory.details.loginDuration",
          cashInHand: "$workStructure.cashInHand",
          totalEarnings: "$appDetailHistory.details.totalEarning",
          calculatedPayment: 1,
          paymentSettled: "$appDetailHistory.details.paymentSettled",
          detailId: "$appDetailHistory.detailId",
          geofence: "$geofenceId",
        },
      },
      { $sort: { workedDate: -1 } },
      {
        $skip:
          (parseInt(req.query.page || 1) - 1) * parseInt(req.query.limit || 50),
      },
      { $limit: parseInt(req.query.limit || 50) },
    ]);

    // Total documents count for pagination
    const totalDocuments = agents?.length || 1;
    const totalPages = Math.ceil(
      totalDocuments / parseInt(req.query.limit || 50)
    );

    const formattedResponse = agents.map(
      ({ _id, workedDate, loginHours, ...rest }) => ({
        agentId: _id,
        workedDate: workedDate ? formatDate(workedDate) : "-",
        loginHours: formatToHours(loginHours),
        ...rest,
      })
    );

    res.status(200).json({
      message: "Filtered agent payout details",
      data: formattedResponse,
      pagination: {
        totalDocuments,
        totalPages,
        currentPage: parseInt(req.query.page || 1),
        pageSize: parseInt(req.query.limit || 50),
        hasNextPage: parseInt(req.query.page || 1) < totalPages,
        hasPrevPage: parseInt(req.query.page || 1) > 1,
      },
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const approvePaymentController = async (req, res, next) => {
  try {
    const { agentId, detailId } = req.params;

    // Find agent with required fields and the specific detail in appDetailHistory
    const agent = await Agent.findOne(
      { _id: agentId, "appDetailHistory._id": detailId },
      {
        "appDetailHistory.$": 1,
        "workStructure.cashInHand": 1,
        agentTransaction: 1,
      }
    ).lean();

    if (!agent) return next(appError("Agent not found", 404));

    const detail = agent.appDetailHistory[0];
    if (detail.details.paymentSettled)
      return next(appError("Payment already settled", 400));

    // Get the totalEarning from the specific detail in appDetailHistory
    const detailTotalEarning = detail.details.totalEarning;

    // Prepare updates for payment settlement and cashInHand adjustment if needed
    const updates = {
      "appDetailHistory.$.details.paymentSettled": true,
    };

    const transactionUpdates = [];

    // Calculate the maximum possible debit amount from cashInHand and totalEarning
    if (agent.workStructure.cashInHand > 0) {
      const debitAmount = Math.min(
        agent.workStructure.cashInHand,
        detailTotalEarning
      );
      const calculatedBalance = agent.workStructure.cashInHand - debitAmount;

      console.log("cash in hand: ", agent.workStructure.cashInHand);
      console.log("calculatedBalance: ", calculatedBalance);
      console.log("detailTotalEarning: ", detailTotalEarning);
      console.log("debitAmount: ", debitAmount);

      updates["workStructure.cashInHand"] = calculatedBalance;

      transactionUpdates.push(
        {
          type: "Debit",
          title: "Cash in hand deducted",
          madeOn: new Date(),
          amount: debitAmount,
        },
        {
          type: "Credit",
          title: "Salary credited",
          madeOn: new Date(),
          amount: detailTotalEarning,
        }
      );
    } else {
      // Only add a Credit transaction
      transactionUpdates.push({
        type: "Credit",
        title: "Salary credited",
        madeOn: new Date(),
        amount: detailTotalEarning,
      });
    }

    // Apply updates in a single atomic operation
    const updatedAgent = await Agent.updateOne(
      { _id: agentId, "appDetailHistory._id": detailId },
      {
        $set: updates,
        $push: { agentTransaction: { $each: transactionUpdates } },
      }
    );

    if (updatedAgent.nModified === 0)
      return next(appError("Failed to approve payment", 500));

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
    const filter = { isApproved: "Approved" };
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

    const filePath = path.join(__dirname, "../../../sample_CSV/sample_CSV.csv");

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

    // Define filter criteria
    const filterCriteria = { isApproved: "Approved" };
    if (agent && agent.toLowerCase() !== "all") filterCriteria._id = agent;
    if (geofence && geofence.toLowerCase() !== "all")
      filterCriteria.geofenceId = geofence;
    if (search)
      filterCriteria.$or = [{ _id: { $regex: search, $options: "i" } }];

    // Date range for filtering
    const dateFilter = {};
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      dateFilter.date = { $gte: startDate, $lte: endDate };
    }

    // Aggregation pipeline
    const agents = await Agent.aggregate([
      { $match: filterCriteria },
      { $unwind: "$appDetailHistory" },
      {
        $match: {
          ...(date ? { "appDetailHistory.date": dateFilter.date } : {}),
          ...(paymentStatus
            ? {
                "appDetailHistory.details.paymentSettled":
                  paymentStatus.toLowerCase() === "true",
              }
            : {}),
        },
      },
      {
        $lookup: {
          from: "agentpricings",
          localField: "workStructure.salaryStructureId",
          foreignField: "_id",
          as: "salaryStructure",
        },
      },
      { $unwind: "$salaryStructure" },
      {
        $lookup: {
          from: "geofences",
          localField: "geofenceId",
          foreignField: "_id",
          as: "geofence",
        },
      },
      { $unwind: { path: "$geofence", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          adjustedEarnings: {
            $cond: {
              if: {
                $and: [
                  {
                    $gte: [
                      "$appDetailHistory.details.orders",
                      "$salaryStructure.minOrderNumber",
                    ],
                  },
                  {
                    $gte: [
                      "$appDetailHistory.details.loginDuration",
                      {
                        $multiply: ["$salaryStructure.minLoginHours", 3600000],
                      },
                    ],
                  },
                ],
              },
              then: {
                $cond: {
                  if: {
                    $lt: [
                      "$appDetailHistory.details.totalEarning",
                      "$salaryStructure.baseFare",
                    ],
                  },
                  then: {
                    $subtract: [
                      "$salaryStructure.baseFare",
                      "$workStructure.cashInHand",
                    ],
                  },
                  else: {
                    $subtract: [
                      "$appDetailHistory.details.totalEarning",
                      "$workStructure.cashInHand",
                    ],
                  },
                },
              },
              else: {
                $subtract: [
                  "$appDetailHistory.details.totalEarning",
                  "$workStructure.cashInHand",
                ],
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          fullName: 1,
          phoneNumber: 1,
          workedDate: "$appDetailHistory.date",
          orders: "$appDetailHistory.details.orders",
          cancelledOrders: "$appDetailHistory.details.cancelledOrders",
          totalDistance: "$appDetailHistory.details.totalDistance",
          loginHours: {
            $divide: ["$appDetailHistory.details.loginDuration", 3600000],
          },
          cashInHand: "$workStructure.cashInHand",
          totalEarnings: "$appDetailHistory.details.totalEarning",
          adjustedEarnings: 1,
          paymentSettled: "$appDetailHistory.details.paymentSettled",
          geofenceName: "$geofence.name",
          accountHolderName: "$bankDetail.accountHolderName",
          accountNumber: "$bankDetail.accountNumber",
          IFSCCode: "$bankDetail.IFSCCode",
          UPIId: "$bankDetail.UPIId",
        },
      },
    ]);

    // Format workedDate using formatDate function
    const formattedAgents = agents.map((agent) => ({
      ...agent,
      workedDate: agent.workedDate ? formatDate(agent.workedDate) : "-",
    }));

    // Set up CSV file path and headers
    const filePath = path.join(
      __dirname,
      "../../../sample_CSV/Agent_Payments.csv"
    );
    const csvHeaders = [
      { id: "_id", title: "Agent ID" },
      { id: "fullName", title: "Full Name" },
      { id: "phoneNumber", title: "Phone Number" },
      { id: "workedDate", title: "Worked Date" },
      { id: "orders", title: "Orders" },
      { id: "cancelledOrders", title: "Cancelled Orders" },
      { id: "totalDistance", title: "Total Distance" },
      { id: "loginHours", title: "Login Hours" },
      { id: "cashInHand", title: "Cash In Hand" },
      { id: "totalEarnings", title: "Total Earnings" },
      { id: "adjustedEarnings", title: "Adjusted Payment" },
      { id: "paymentSettled", title: "Payment Settled" },
      { id: "accountHolderName", title: "Account Holder Name" },
      { id: "accountNumber", title: "Account Number" },
      { id: "IFSCCode", title: "IFSC Code" },
      { id: "UPIId", title: "UPI Id" },
      { id: "geofenceName", title: "Geofence Name" },
    ];

    // Create CSV writer
    const writer = csvWriter({
      path: filePath,
      header: csvHeaders,
    });

    // Write records to CSV
    await writer.writeRecords(formattedAgents);

    // Send the CSV file in response
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
