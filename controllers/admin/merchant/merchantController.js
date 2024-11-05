const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const appError = require("../../../utils/appError");
const {
  uploadToFirebase,
  deleteFromFirebase,
} = require("../../../utils/imageOperation");
const Merchant = require("../../../models/Merchant");
const {
  createRazorpayOrderId,
  verifyPayment,
} = require("../../../utils/razorpayPayment");
const {
  getPlanAmount,
  calculateEndDate,
} = require("../../../utils/sponsorshipHelpers");
const mongoose = require("mongoose");
const AccountLogs = require("../../../models/AccountLogs");
const csvParser = require("csv-parser");
const { Readable } = require("stream");
const axios = require("axios");
const path = require("path");
const { sendNotification, sendSocketData } = require("../../../socket/socket");
const NotificationSetting = require("../../../models/NotificationSetting");
const csvWriter = require("csv-writer").createObjectCsvWriter;
const { createTransport } = require("nodemailer");
const { formatDate } = require("../../../utils/formatters");
const Commission = require("../../../models/Commission");
const SubscriptionLog = require("../../../models/SubscriptionLog");
const Category = require("../../../models/Category");
const Product = require("../../../models/Product");
const sharp = require("sharp");
const ActivityLog = require("../../../models/ActivityLog");
const ejs = require("ejs");
const MerchantSubscription = require("../../../models/MerchantSubscription");
const Order = require("../../../models/Order");

// Helper function to handle null or empty string values
const convertNullValues = (obj) => {
  Object.keys(obj).forEach((key) => {
    if (obj[key] === "null" || obj[key] === "") {
      obj[key] = null;
    }
  });
};

const transformAvailabilityValues = (availability) => {
  if (typeof availability !== "object" || availability === null) {
    return availability;
  }

  const transformedAvailability = {};

  for (const day in availability) {
    if (Object.prototype.hasOwnProperty.call(availability, day)) {
      const dayData = availability[day];
      transformedAvailability[day] =
        dayData && typeof dayData === "object"
          ? {
              ...dayData,
              openAllDay: dayData.openAllDay === "true",
              closedAllDay: dayData.closedAllDay === "true",
              specificTime: dayData.specificTime === "true",
              startTime:
                dayData.startTime === "null" ? null : dayData.startTime,
              endTime: dayData.endTime === "null" ? null : dayData.endTime,
            }
          : dayData;
    }
  }

  return transformedAvailability;
};

//----------------------------
// -------For Merchant--------
//-----------------------------

//Register
const registerMerchantController = async (req, res, next) => {
  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const { fullName, email, phoneNumber, password } = req.body;

    const normalizedEmail = email.toLowerCase();

    const merchantExists = await Merchant.findOne({ email: normalizedEmail });

    if (merchantExists) {
      formattedErrors.email = "Email already exists";
      return res.status(409).json({ errors: formattedErrors });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newMerchant = new Merchant({
      fullName,
      email: normalizedEmail,
      phoneNumber,
      password: hashedPassword,
    });
    await newMerchant.save();

    const notification = await NotificationSetting.findOne({
      event: "newMerchant",
    });

    const event = "newMerchant";
    const role = "Merchant";

    const data = {
      title: notification.title,
      description: notification.description,
    };

    sendNotification(process.env.ADMIN_ID, event, data, role);
    sendSocketData(process.env.ADMIN_ID, event, data);

    if (newMerchant) {
      res.status(201).json({
        success: "Merchant registered successfully",
        _id: newMerchant._id,
      });
    } else {
      return next(appError("Error in registering new merchant"));
    }
  } catch (err) {
    next(appError(err.message));
  }
};

// Get profile
const getMerchantProfileController = async (req, res, next) => {
  try {
    const merchantId = req.userAuth;

    const merchantFound = await Merchant.findById(merchantId)
      .populate("merchantDetail.geofenceId", "name _id")
      .populate("merchantDetail.pricing")
      .select("-password")
      .lean({ virtuals: true });

    if (!merchantFound) {
      return next(appError("Merchant not found", 404));
    }

    let merchantPricing = {};
    const pricing = merchantFound?.merchantDetail?.pricing?.[0];

    if (pricing?.modelType === "Commission") {
      const commission = await Commission.findById(pricing?.modelId);
      merchantPricing = {
        modelType: "Commission",
        detail: {
          type: commission?.commissionType?.toString() || "-",
          value: commission?.commissionValue?.toString() || "-",
        },
      };
    } else if (
      merchantFound?.merchantDetail?.pricing[0]?.modelType === "Subscription"
    ) {
      const subscriptionLog = await SubscriptionLog.findById(
        merchantFound?.merchantDetail?.pricing[0]?.modelId
      );

      const planFound = await MerchantSubscription.findById(
        subscriptionLog.planId
      )
        .select("name")
        .lean();

      merchantPricing = {
        modelType: "Subscription",
        modelId: subscriptionLog?._id,
        detail: {
          type: planFound?.name || "-",
          value: planFound?.name || "-",
        },
      };
    }

    const formattedResponse = {
      _id: merchantFound._id,
      fullName: merchantFound.fullName,
      email: merchantFound.email,
      phoneNumber: merchantFound.phoneNumber,
      isApproved: merchantFound.isApproved,
      status: merchantFound.status,
      isBlocked: merchantFound.isBlocked,
      merchantDetail:
        {
          ...merchantFound?.merchantDetail,
          pricing: merchantPricing ? merchantPricing : null,
          geofenceId: merchantFound?.merchantDetail?.geofenceId?._id || "",
          businessCategoryId:
            merchantFound?.merchantDetail?.businessCategoryId || [],
        } || {},
      sponsorshipDetail: merchantFound?.sponsorshipDetail[0] || {},
    };

    res.status(200).json({
      message: "Merchant profile",
      data: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

//Change status by merchant
const changeMerchantStatusByMerchantController = async (req, res, next) => {
  try {
    const merchantFound = await Merchant.findById(req.userAuth);

    if (!merchantFound) {
      return next(appError("Merchant not found", 404));
    }

    const currentDate = new Date();
    const currentDay = currentDate
      .toLocaleString("en-us", { weekday: "long" })
      .toLowerCase(); // get the current day in lowercase (e.g., 'monday')
    const currentTime = currentDate.toLocaleTimeString("en-GB", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    }); // 24-hour format time (e.g., '16:30')

    // Get today's availability
    const availability =
      merchantFound.merchantDetail.availability?.specificDays?.[currentDay];

    if (!availability) {
      return next(appError("Merchant availability not set for today", 400));
    }

    // Check if merchant is closed all day
    if (availability.closedAllDay) {
      return next(appError("Merchant is closed all day.", 400));
    }

    // Check if merchant is open all day
    if (availability.openAllDay) {
      merchantFound.status = !merchantFound.status;
      merchantFound.openedToday = true;
      await merchantFound.save();
      return res
        .status(200)
        .json({ message: "Merchant status changed successfully." });
    }

    // Check specific time availability
    if (availability.specificTime) {
      const { startTime, endTime } = availability;

      if (currentTime >= startTime && currentTime <= endTime) {
        // Toggle status as the current time falls within available hours
        merchantFound.status = !merchantFound.status;
        merchantFound.openedToday = true;
        await merchantFound.save();
        return res
          .status(200)
          .json({ message: "Merchant status changed successfully." });
      } else {
        return next(
          appError("Merchant is not within the available hours.", 400)
        );
      }
    }

    // Default case: if no conditions match, assume not ready to open
    return next(
      appError("Merchant is not ready to open at the current time.", 400)
    );
  } catch (err) {
    next(appError(err.message));
  }
};

const changeMerchantStatusByMerchantControllerForToggle = async (
  req,
  res,
  next
) => {
  try {
    const { status } = req.body;
    const merchantFound = await Merchant.findById(req.userAuth);

    if (!merchantFound) {
      return next(appError("Merchant not found", 404));
    }

    if (status) {
      merchantFound.status = true;
      merchantFound.openedToday = true;
    } else {
      merchantFound.status = false;
      // merchantFound.openedToday = true;
    }

    await merchantFound.save();

    res.status(200).json({ message: "Merchant status changed" });
  } catch (err) {
    next(appError(err.message));
  }
};

const editMerchantProfileController = async (req, res, next) => {
  const { fullName, email, phoneNumber, password } = req.body;

  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const merchantId = req.userAuth;

    const merchantFound = await Merchant.findById(merchantId);

    if (!merchantFound) {
      return next(appError("Merchant not found", 404));
    }

    const normalizedEmail = email.toLowerCase();

    if (normalizedEmail !== merchantFound.email) {
      const emailExists = await Merchant.findOne({
        _id: { $ne: merchantId },
        email: normalizedEmail,
      });

      if (emailExists) {
        formattedErrors.email = "Email already exists";
        return res.status(409).json({ errors: formattedErrors });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const updatedMerchant = await Merchant.findByIdAndUpdate(
      merchantId,
      {
        fullName,
        email: normalizedEmail,
        phoneNumber,
        password: hashedPassword,
      },
      { new: true }
    );

    if (!updatedMerchant) {
      return next(appError("Error in updating merchant"));
    }

    res.status(200).json({ message: "Merchant updated successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

//Update Merchant Details by merchant
const updateMerchantDetailsByMerchantController = async (req, res, next) => {
  const { fullName, email, phoneNumber, merchantDetail } = req.body;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().reduce((acc, error) => {
      acc[error.path] = error.msg;
      return acc;
    }, {});
    return res.status(400).json({ errors: formattedErrors });
  }

  try {
    const merchantId = req.userAuth;

    const merchantFound = await Merchant.findById(merchantId);

    if (!merchantFound) return next(appError("Merchant not found", 404));

    // Apply the helper function to handle null or empty string values

    if (merchantDetail) {
      convertNullValues(merchantDetail);
      if (merchantDetail.availability) {
        merchantDetail.availability.specificDays = transformAvailabilityValues(
          merchantDetail.availability.specificDays
        );
      }
    }

    let merchantImageURL =
      merchantFound?.merchantDetail?.merchantImageURL || "";
    let pancardImageURL = merchantFound?.merchantDetail?.pancardImageURL || "";
    let GSTINImageURL = merchantFound?.merchantDetail?.GSTINImageURL || "";
    let FSSAIImageURL = merchantFound?.merchantDetail?.FSSAIImageURL || "";
    let aadharImageURL = merchantFound?.merchantDetail?.aadharImageURL || "";

    if (req.files) {
      const {
        merchantImage,
        pancardImage,
        GSTINImage,
        FSSAIImage,
        aadharImage,
      } = req.files;

      if (merchantImage) {
        if (merchantImageURL) {
          await deleteFromFirebase(merchantImageURL);
        }
        merchantImageURL = await uploadToFirebase(
          merchantImage[0],
          "MerchantImages"
        );
      }
      if (pancardImage) {
        if (pancardImageURL) {
          await deleteFromFirebase(pancardImageURL);
        }
        pancardImageURL = await uploadToFirebase(
          pancardImage[0],
          "PancardImages"
        );
      }
      if (GSTINImage) {
        if (GSTINImageURL) {
          await deleteFromFirebase(GSTINImageURL);
        }
        GSTINImageURL = await uploadToFirebase(GSTINImage[0], "GSTINImages");
      }
      if (FSSAIImage) {
        if (FSSAIImageURL) {
          await deleteFromFirebase(FSSAIImageURL);
        }
        FSSAIImageURL = await uploadToFirebase(FSSAIImage[0], "FSSAIImages");
      }
      if (aadharImage) {
        if (aadharImageURL) {
          await deleteFromFirebase(aadharImageURL);
        }
        aadharImageURL = await uploadToFirebase(aadharImage[0], "AadharImages");
      }
    }

    let newLocation = [
      parseFloat(merchantDetail?.location[0]),
      parseFloat(merchantDetail?.location[1]),
    ];

    const arraysAreEqual = (arr1, arr2) => {
      return (
        arr1?.length === arr2?.length &&
        arr1?.every((value, index) => value === arr2[index])
      );
    };

    let locationImage;

    if (!arraysAreEqual(newLocation, merchantFound?.merchantDetail?.location)) {
      if (merchantFound?.merchantDetail?.locationImage) {
        await deleteFromFirebase(merchantFound?.merchantDetail?.locationImage);
      }

      const url = `https://apis.mapmyindia.com/advancedmaps/v1/9a632cda78b871b3a6eb69bddc470fef/still_image?center=${newLocation[0]}, ${newLocation[1]}&size=400x500&markers=${newLocation[0]}, ${newLocation[1]}&zoom=15`;

      try {
        const response = await axios.get(url, { responseType: "arraybuffer" });
        // Process the image using sharp to convert it to PNG format
        const imageBuffer = await sharp(response.data).png().toBuffer();
        locationImage = await uploadToFirebase(
          imageBuffer,
          "MerchantLocationImage"
        );
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch data from Mappls API" });
      }
    }

    merchantDetail.locationImage = locationImage;

    const details = {
      ...merchantDetail,
      "availability.type":
        merchantDetail?.availability?.type === "null"
          ? null
          : merchantDetail?.availability?.type,
      "availability.specificDays": merchantDetail?.availability?.specificDays,
      geofenceId: merchantDetail?.geofenceId || null,
      businessCategoryId: merchantDetail?.businessCategoryId || null,
      pricing: merchantFound?.merchantDetail?.pricing
        ? merchantFound?.merchantDetail.pricing
        : [],
      merchantImageURL,
      pancardImageURL,
      GSTINImageURL,
      FSSAIImageURL,
      aadharImageURL,
    };

    merchantFound.fullName = fullName;
    merchantFound.email = email;
    merchantFound.phoneNumber = phoneNumber;
    merchantFound.merchantDetail = details;

    await merchantFound.save();

    await ActivityLog.create({
      userId: req.userAuth,
      userType: req.userRole,
      description: `Details are updated by Merchant (${req.userAuth})`,
    });

    res.status(200).json({ message: "Merchant details added successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

//Initiate Merchant sponsorship payment by merchant
const sponsorshipPaymentByMerchantController = async (req, res, next) => {
  const { sponsorshipStatus, currentPlan } = req.body;

  try {
    const merchantId = req.userAuth;

    const merchantFound = await Merchant.findById(merchantId);

    if (!merchantFound) {
      return next(appError("Merchant not found", 404));
    }

    if (sponsorshipStatus) {
      const planAmount = getPlanAmount(currentPlan);
      const paymentResponse = await createRazorpayOrderId(planAmount);

      if (paymentResponse.success) {
        // Returning order details to the client for further processing
        return res.status(200).json({
          success: true,
          orderId: paymentResponse.orderId,
          amount: planAmount,
          currentPlan,
        });
      } else {
        return next(appError("Payment initialization failed", 400));
      }
    } else {
      return res.status(400).json({ message: "Invalid sponsorship status" });
    }
  } catch (err) {
    next(appError(err.messsage));
  }
};

//Verify Merchant sponsorship payment by merchant
const verifyPaymentByMerchantController = async (req, res, next) => {
  const merchantId = req.userAuth;
  const paymentDetails = req.body;

  try {
    const merchantFound = await Merchant.findById(merchantId);

    if (!merchantFound) {
      return next(appError("Merchant not found", 404));
    }

    const isValidPayment = await verifyPayment(paymentDetails);

    if (isValidPayment) {
      const { currentPlan } = paymentDetails;
      let startDate = new Date();

      const existingSponsorships = merchantFound?.sponsorshipDetail;

      // Check if there's an existing sponsorship that hasn't ended yet
      if (existingSponsorships.length > 0) {
        const lastSponsorship =
          existingSponsorships[existingSponsorships.length - 1];
        if (new Date(lastSponsorship.endDate) > new Date()) {
          startDate = new Date(lastSponsorship.endDate);
        }
      }

      const endDate = calculateEndDate(startDate, currentPlan);

      const newSponsorship = {
        sponsorshipStatus: true,
        currentPlan,
        startDate,
        endDate,
        paymentDetails: JSON.stringify(paymentDetails),
      };

      merchantFound.sponsorshipDetail.push(newSponsorship);

      await merchantFound.save();

      return res.status(200).json({
        success: true,
        message: "Payment verified and sponsorship updated",
      });
    } else {
      return next(appError("Payment verification failed", 400));
    }
  } catch (err) {
    next(appError(err.message));
  }
};

//----------------------------
// ------For Admin Panel------
//----------------------------

// Search merchant controller
const searchMerchantController = async (req, res, next) => {
  try {
    let { query, page = 1, limit = 20 } = req.query;

    if (!query || query.trim() === "") {
      return res.status(400).json({
        message: "Search query cannot be empty",
      });
    }

    // Convert to integers
    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    // Calculate the number of documents to skip
    const skip = (page - 1) * limit;

    const searchTerm = query.toLowerCase();

    // Perform search with geofenceId populated
    const searchResults = await Merchant.find({
      "merchantDetail.merchantName": { $regex: searchTerm, $options: "i" },
    })
      .select("fullName phoneNumber isApproved status merchantDetail")
      .populate("merchantDetail.geofenceId", "name")
      .populate("merchantDetail.businessCategoryId", "title")
      .sort({
        "merchantDetail.merchantName": 1,
        phoneNumber: 1,
      })
      .skip(skip)
      .limit(limit);

    // Count total documents
    const totalDocuments = searchResults?.length || 1;

    const merchantsWithDetails = searchResults.map((merchant) => {
      return {
        _id: merchant._id,
        merchantName: merchant?.merchantDetail?.merchantName || "-",
        phoneNumber: merchant.phoneNumber,
        isApproved: merchant.isApproved,
        subscriptionStatus:
          merchant?.merchantDetail?.pricing?.length === 0
            ? "Inactive"
            : "Active",
        status: merchant.status,
        geofence: merchant?.merchantDetail?.geofenceId?.name || "-",
        averageRating: merchant?.merchantDetail?.averageRating,
        isServiceableToday: merchant.status ? "Open" : "Closed",
        businessCategory: merchant.merchantDetail.businessCategoryId,
      };
    });

    let pagination = {
      totalDocuments: totalDocuments || 0,
      totalPages: Math.ceil(totalDocuments / limit),
      currentPage: page || 1,
      pageSize: limit,
      hasNextPage: page < Math.ceil(totalDocuments / limit),
      hasPrevPage: page > 1,
    };

    res.status(200).json({
      message: "Searched merchant results",
      data: merchantsWithDetails,
      pagination,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Filter merchant
const filterMerchantsController = async (req, res, next) => {
  try {
    let {
      serviceable,
      businessCategory,
      geofence,
      page = 1,
      limit = 20,
    } = req.query;

    // Convert to integers
    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    // Calculate the number of documents to skip
    const skip = (page - 1) * limit;

    const filterCriteria = {};

    // Add filters based on query parameters
    if (serviceable && serviceable.toLowerCase() !== "all") {
      if (!["true", "false"].includes(serviceable.toLowerCase())) {
        return res.status(400).json({ message: "Invalid serviceable value" });
      }
      filterCriteria.status = serviceable.toLowerCase();
    }

    if (businessCategory && businessCategory.toLowerCase() !== "all") {
      try {
        filterCriteria["merchantDetail.businessCategoryId"] =
          new mongoose.Types.ObjectId(businessCategory.trim());
      } catch (err) {
        return res
          .status(400)
          .json({ message: "Invalid business category ID" });
      }
    }

    if (geofence && geofence.toLowerCase() !== "all") {
      try {
        filterCriteria["merchantDetail.geofenceId"] =
          new mongoose.Types.ObjectId(geofence.trim());
      } catch (err) {
        return res.status(400).json({ message: "Invalid geofence ID" });
      }
    }

    // Fetch merchants based on the constructed filter criteria
    const filteredMerchants = await Merchant.find(filterCriteria)
      .select("fullName phoneNumber isApproved status merchantDetail")
      .populate("merchantDetail.geofenceId", "name")
      .sort({
        "merchantDetail.merchantName": 1,
        phoneNumber: 1,
      })
      .skip(skip)
      .limit(limit);

    // Count total documents
    const totalDocuments = filteredMerchants?.length || 1;

    const merchantsWithDetails = filteredMerchants.map((merchant) => {
      return {
        _id: merchant._id,
        merchantName: merchant?.merchantDetail?.merchantName || "-",
        phoneNumber: merchant.phoneNumber,
        isApproved: merchant.isApproved,
        subscriptionStatus:
          merchant?.merchantDetail?.pricing?.length === 0
            ? "Inactive"
            : "Active",
        status: merchant.status,
        geofence: merchant?.merchantDetail?.geofenceId?.name || "-",
        averageRating: merchant?.merchantDetail?.averageRating,
        isServiceableToday: merchant.status ? "Open" : "Closed",
      };
    });

    let pagination = {
      totalDocuments: totalDocuments || 0,
      totalPages: Math.ceil(totalDocuments / limit),
      currentPage: page || 1,
      pageSize: limit,
      hasNextPage: page < Math.ceil(totalDocuments / limit),
      hasPrevPage: page > 1,
    };

    res.status(200).json({
      message: "Filtered merchants",
      data: merchantsWithDetails,
      pagination,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get ratings and reviews by customer
const getRatingsAndReviewsByCustomerController = async (req, res, next) => {
  try {
    const merchantFound = await Merchant.findById(
      req.params.merchantId
    ).populate({
      path: "ratingsByCustomers",
      populate: {
        path: "customerId",
        model: "Customer",
        select: "fullName _id", // Selecting the fields of fullName and _id from Customer
      },
    });

    if (!merchantFound) {
      return next(appError("Agent not found", 404));
    }

    const ratings = merchantFound?.merchantDetail?.ratingByCustomers?.map(
      (rating) => ({
        review: rating.review,
        rating: rating.rating,
        customerId: {
          id: rating.customerId._id,
          fullName: rating.customerId.fullName,
        },
      })
    );

    res.status(200).json({
      message: "Ratings of agent by customer",
      data: ratings,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Approve merchant registration
const approveRegistrationController = async (req, res, next) => {
  try {
    const merchantFound = await Merchant.findById(req.params.merchantId);

    if (!merchantFound) {
      return next(appError("Merchant not found", 404));
    }

    merchantFound.isApproved = "Approved";
    await merchantFound.save();

    res.status(200).json({
      message: "Approved merchant registration",
      data: merchantFound.isApproved,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Reject merchant registration
const rejectRegistrationController = async (req, res, next) => {
  try {
    const merchantFound = await Merchant.findById(req.params.merchantId);

    if (!merchantFound) {
      return next(appError("Merchant not found", 404));
    }

    // Send email with message
    const rejectionTemplatePath = path.join(
      __dirname,
      "../../../templates/rejectionTemplate.ejs"
    );

    const htmlContent = await ejs.renderFile(rejectionTemplatePath, {
      recipientName: merchantFound.fullName,
      app: "merchant",
      email: "contact@famto.in",
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
      to: merchantFound.email,
      subject: "Registration rejection",
      html: htmlContent,
    });

    await Merchant.findByIdAndDelete(req.params.merchantId);

    res.status(200).json({
      message: "Declined merchant registration",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get all merchants for dropdown
const getAllMerchantsForDropDownController = async (req, res, next) => {
  try {
    // Find merchants, sort by merchantName alphabetically and phoneNumber numerically
    const merchantsFound = await Merchant.find({ isBlocked: false })
      .select("merchantDetail")
      .sort({
        "merchantDetail.merchantName": 1,
        phoneNumber: 1,
      });

    const formattedResponse = merchantsFound?.map((merchant) => {
      return {
        _id: merchant._id,
        merchantName: merchant?.merchantDetail?.merchantName || "-",
      };
    });

    res.status(200).json({
      message: "All merchants for drop-down",
      data: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get all merchants for panel
const getAllMerchantsController = async (req, res, next) => {
  try {
    // Get page and limit from query parameters
    let { page = 1, limit = 50 } = req.query;

    // Convert to integers
    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    // Calculate the number of documents to skip
    const skip = (page - 1) * limit;

    // Find merchants, sort by merchantName alphabetically and phoneNumber numerically
    const merchantsFound = await Merchant.find({ isBlocked: false })
      .select("fullName phoneNumber isApproved status merchantDetail")
      .populate("merchantDetail.geofenceId", "name")
      .sort({
        "merchantDetail.merchantName": 1,
        phoneNumber: 1,
      })
      .skip(skip)
      .limit(limit);

    // Count total documents
    const totalDocuments = await Merchant.countDocuments({});

    const merchantsWithDetails = merchantsFound.map((merchant) => {
      return {
        _id: merchant._id,
        merchantName: merchant?.merchantDetail?.merchantName || "-",
        phoneNumber: merchant.phoneNumber,
        isApproved: merchant.isApproved,
        subscriptionStatus:
          merchant?.merchantDetail?.pricing?.length === 0
            ? "Inactive"
            : "Active",
        status: merchant.status,
        geofence: merchant?.merchantDetail?.geofenceId?.name || "-",
        averageRating: merchant?.merchantDetail?.averageRating || "0",
        isServiceableToday: merchant.status ? "Open" : "Closed",
      };
    });

    let pagination = {
      totalDocuments: totalDocuments || 0,
      totalPages: Math.ceil(totalDocuments / limit),
      currentPage: page || 1,
      pageSize: limit,
      hasNextPage: page < Math.ceil(totalDocuments / limit),
      hasPrevPage: page > 1,
    };

    res.status(200).json({
      message: "Getting all merchants",
      data: merchantsWithDetails,
      pagination,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get single merchant detail by Id
const getSingleMerchantController = async (req, res, next) => {
  try {
    const merchantFound = await Merchant.findById(req.params.merchantId)
      .populate("merchantDetail.geofenceId", "name _id")
      .populate("merchantDetail.pricing")
      .select("-password")
      .lean({ virtuals: true });

    if (!merchantFound) {
      return next(appError("Merchant not found", 404));
    }

    let merchantPricing = {};
    const pricing = merchantFound?.merchantDetail?.pricing?.[0];

    if (pricing?.modelType === "Commission") {
      const commission = await Commission.findById(pricing?.modelId);
      merchantPricing = {
        modelType: "Commission",
        detail: {
          type: commission?.commissionType?.toString() || null,
          value: commission?.commissionValue?.toString() || null,
        },
      };
    } else if (
      merchantFound?.merchantDetail?.pricing[0]?.modelType === "Subscription"
    ) {
      const subscriptionLog = await SubscriptionLog.findById(
        merchantFound?.merchantDetail?.pricing[0]?.modelId
      );

      const planFound = await MerchantSubscription.findById(
        subscriptionLog.planId
      )
        .select("name")
        .lean();

      merchantPricing = {
        modelType: "Subscription",
        modelId: subscriptionLog?._id,
        detail: {
          type: planFound?.name || null,
          value: planFound?.name || null,
        },
      };
    }

    const formattedResponse = {
      _id: merchantFound._id,
      fullName: merchantFound.fullName,
      email: merchantFound.email,
      phoneNumber: merchantFound.phoneNumber,
      isApproved: merchantFound.isApproved,
      status: merchantFound.status,
      isBlocked: merchantFound.isBlocked,
      merchantDetail:
        {
          ...merchantFound?.merchantDetail,
          pricing: merchantPricing ? merchantPricing : null,
          geofenceId: merchantFound?.merchantDetail?.geofenceId?._id || "",
          businessCategoryId:
            merchantFound?.merchantDetail?.businessCategoryId || [],
        } || {},
      sponsorshipDetail: merchantFound?.sponsorshipDetail[0] || {},
    };

    res.status(200).json({
      message: "Single merchant details",
      data: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Add merchant
const addMerchantController = async (req, res, next) => {
  const { fullName, email, phoneNumber, password } = req.body;

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

    const merchantFound = await Merchant.findOne({ email: normalizedEmail });

    if (merchantFound) {
      formattedErrors.email = "Email already exists";
      return res.status(409).json({ errors: formattedErrors });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newMerchant = await Merchant.create({
      fullName,
      email: normalizedEmail,
      phoneNumber,
      password: hashedPassword,
    });

    if (!newMerchant) {
      return next(appError("Error in creating new merchant"));
    }

    await ActivityLog.create({
      userId: req.userAuth,
      userType: req.userRole,
      description: `New merchant (${newMerchant.fullName}) is added by ${req.userRole} (${req.userAuth})`,
    });

    const formattedResponse = {
      _id: newMerchant._id,
      merchantName: "-",
      phoneNumber: newMerchant.phoneNumber,
      isApproved: "Pending",
      subscriptionStatus: "Inactive",
      status: false,
      geofence: "-",
      averageRating: "0",
      isServiceableToday: "Closed",
    };

    res.status(201).json({
      message: "Merchant added successfully",
      data: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Edit merchant
const editMerchantController = async (req, res, next) => {
  const { fullName, email, phoneNumber, password } = req.body;

  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const { merchantId } = req.params;

    const merchantFound = await Merchant.findById(merchantId);

    if (!merchantFound) {
      return next(appError("Merchant not found", 404));
    }

    const normalizedEmail = email.toLowerCase();

    if (normalizedEmail !== merchantFound.email) {
      const emailExists = await Merchant.findOne({
        _id: { $ne: merchantId },
        email: normalizedEmail,
      });

      if (emailExists) {
        formattedErrors.email = "Email already exists";
        return res.status(409).json({ errors: formattedErrors });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const updatedMerchant = await Merchant.findByIdAndUpdate(
      merchantId,
      {
        fullName,
        email: normalizedEmail,
        phoneNumber,
        password: hashedPassword,
      },
      { new: true }
    );

    if (!updatedMerchant) {
      return next(appError("Error in updating merchant"));
    }

    res.status(200).json({ message: "Merchant updated successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

// Change merchant status by admin
const changeMerchantStatusController = async (req, res, next) => {
  try {
    const merchantFound = await Merchant.findById(req.params.merchantId);

    if (!merchantFound) {
      return next(appError("Merchant not found", 404));
    }

    if (merchantFound.isApproved === "Pending") {
      return next(appError("Please complete the registration", 400));
    }

    merchantFound.status = !merchantFound.status;
    await merchantFound.save();

    res.status(200).json({ message: "Merchant status changed" });
  } catch (err) {
    next(appError(err.message));
  }
};

// Update Merchant Details by admin
const updateMerchantDetailsController = async (req, res, next) => {
  const { fullName, email, phoneNumber, merchantDetail } = req.body;

  const errors = validationResult(req);
  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const { merchantId } = req.params;

    const merchantFound = await Merchant.findById(merchantId);
    if (!merchantFound) {
      return next(appError("Merchant not found", 404));
    }

    // Apply the helper function to handle null or empty string values
    if (merchantDetail) {
      convertNullValues(merchantDetail);
    }

    let modifiedAvailability;
    if (merchantDetail && merchantDetail.availability) {
      modifiedAvailability = transformAvailabilityValues(
        merchantDetail.availability.specificDays
      );
    }

    let merchantImageURL =
      merchantFound?.merchantDetail?.merchantImageURL || "";
    let pancardImageURL = merchantFound?.merchantDetail?.pancardImageURL || "";
    let GSTINImageURL = merchantFound?.merchantDetail?.GSTINImageURL || "";
    let FSSAIImageURL = merchantFound?.merchantDetail?.FSSAIImageURL || "";
    let aadharImageURL = merchantFound?.merchantDetail?.aadharImageURL || "";

    if (req.files) {
      const {
        merchantImage,
        pancardImage,
        GSTINImage,
        FSSAIImage,
        aadharImage,
      } = req.files;

      if (merchantImage && merchantImage[0]) {
        if (merchantImageURL) {
          await deleteFromFirebase(merchantImageURL);
        }
        merchantImageURL = await uploadToFirebase(
          merchantImage[0],
          "MerchantImages"
        );
      }

      if (pancardImage && pancardImage[0]) {
        if (pancardImageURL) {
          await deleteFromFirebase(pancardImageURL);
        }
        pancardImageURL = await uploadToFirebase(
          pancardImage[0],
          "PancardImages"
        );
      }

      if (GSTINImage && GSTINImage[0]) {
        if (GSTINImageURL) {
          await deleteFromFirebase(GSTINImageURL);
        }
        GSTINImageURL = await uploadToFirebase(GSTINImage[0], "GSTINImages");
      }

      if (FSSAIImage && FSSAIImage[0]) {
        if (FSSAIImageURL) {
          await deleteFromFirebase(FSSAIImageURL);
        }
        FSSAIImageURL = await uploadToFirebase(FSSAIImage[0], "FSSAIImages");
      }

      if (aadharImage && aadharImage[0]) {
        if (aadharImageURL) {
          await deleteFromFirebase(aadharImageURL);
        }
        aadharImageURL = await uploadToFirebase(aadharImage[0], "AadharImages");
      }
    }

    let newLocation = [];

    if (merchantDetail?.location?.length === 2) {
      newLocation = [
        parseFloat(merchantDetail?.location[0]),
        parseFloat(merchantDetail?.location[1]),
      ];
    }

    const arraysAreEqual = (arr1, arr2) => {
      return (
        arr1?.length === arr2?.length &&
        arr1?.every((value, index) => value === arr2[index])
      );
    };

    let locationImage;

    if (!arraysAreEqual(newLocation, merchantFound?.merchantDetail?.location)) {
      if (merchantFound?.merchantDetail?.locationImage) {
        await deleteFromFirebase(merchantFound?.merchantDetail?.locationImage);
      }

      const url = `https://apis.mapmyindia.com/advancedmaps/v1/9a632cda78b871b3a6eb69bddc470fef/still_image?center=${newLocation[0]}, ${newLocation[1]}&size=400x500&markers=${newLocation[0]}, ${newLocation[1]}&zoom=15`;

      try {
        const response = await axios.get(url, { responseType: "arraybuffer" });
        // Process the image using sharp to convert it to PNG format
        const imageBuffer = await sharp(response.data).png().toBuffer();
        locationImage = await uploadToFirebase(
          imageBuffer,
          "MerchantLocationImage"
        );
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch data from Mappls API" });
      }
    }

    merchantDetail.locationImage = locationImage;

    const details = {
      ...merchantDetail,
      "availability.type":
        merchantDetail?.availability?.type === "null"
          ? null
          : merchantDetail?.availability?.type,
      "availability.specificDays": modifiedAvailability,
      geofenceId: merchantDetail?.geofenceId || null,
      businessCategoryId: merchantDetail?.businessCategoryId || null,
      pricing: merchantFound?.merchantDetail?.pricing
        ? merchantFound?.merchantDetail?.pricing
        : [],
      merchantImageURL,
      pancardImageURL,
      GSTINImageURL,
      FSSAIImageURL,
      aadharImageURL,
    };

    merchantFound.fullName = fullName;
    merchantFound.email = email;
    merchantFound.phoneNumber = phoneNumber;
    merchantFound.merchantDetail = details;

    await merchantFound.save();

    await ActivityLog.create({
      userId: req.userAuth,
      userType: req.userRole,
      description: `Details of ${merchantFound.merchantDetail.merchantName} is updated by Admin (${req.userAuth})`,
    });

    res.status(200).json({ message: "Merchant details updated successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

// Initiate Merchant sponsorship payment by admin
const sponsorshipPaymentController = async (req, res, next) => {
  const { sponsorshipStatus, currentPlan } = req.body;

  try {
    const { merchantId } = req.params;

    const merchantFound = await Merchant.findById(merchantId);

    if (!merchantFound) {
      return next(appError("Merchant not found", 404));
    }

    if (sponsorshipStatus) {
      const planAmount = getPlanAmount(currentPlan);
      const paymentResponse = await createRazorpayOrderId(planAmount);

      if (paymentResponse.success) {
        // Returning order details to the client for further processing
        return res.status(200).json({
          success: true,
          orderId: paymentResponse.orderId,
          amount: planAmount,
          currentPlan,
        });
      } else {
        return next(appError("Payment initialization failed", 400));
      }
    } else {
      return res.status(400).json({ message: "Invalid sponsorship status" });
    }
  } catch (err) {
    next(appError(err.messsage));
  }
};

// Verify Merchant sponsorship payment by admin
const verifyPaymentController = async (req, res, next) => {
  const { merchantId } = req.params;
  const paymentDetails = req.body;

  try {
    const merchantFound = await Merchant.findById(merchantId);

    if (!merchantFound) {
      return next(appError("Merchant not found", 404));
    }

    const isValidPayment = await verifyPayment(paymentDetails);

    if (isValidPayment) {
      const { currentPlan } = paymentDetails;
      let startDate = new Date();

      const existingSponsorships = merchantFound?.sponsorshipDetail;

      // Check if there's an existing sponsorship that hasn't ended yet
      if (existingSponsorships.length > 0) {
        const lastSponsorship =
          existingSponsorships[existingSponsorships.length - 1];
        if (new Date(lastSponsorship.endDate) > new Date()) {
          startDate = new Date(lastSponsorship.endDate);
        }
      }

      const endDate = calculateEndDate(startDate, currentPlan);

      const newSponsorship = {
        sponsorshipStatus: true,
        currentPlan,
        startDate,
        endDate,
        paymentDetails: JSON.stringify(paymentDetails),
      };

      merchantFound.sponsorshipDetail.push(newSponsorship);

      await merchantFound.save();

      return res.status(200).json({
        success: true,
        message: "Payment verified and sponsorship updated",
      });
    } else {
      return next(appError("Payment verification failed", 400));
    }
  } catch (err) {
    next(appError(err.message));
  }
};

// Block a merchant
const blockMerchant = async (req, res, next) => {
  try {
    const { merchantId } = req.params;
    const { reasonForBlocking } = req.body;

    const merchantFound = await Merchant.findById(merchantId);

    if (merchantFound.isBlocked) {
      return next(appError("Merchant is already blocked", 400));
    }

    merchantFound.isBlocked = true;
    merchantFound.reasonForBlockingOrDeleting = reasonForBlocking;
    merchantFound.blockedDate = new Date();
    await merchantFound.save();

    const accountLogs = await AccountLogs.create({
      userId: merchantFound._id,
      fullName: merchantFound.fullName,
      role: merchantFound.role,
      description: reasonForBlocking,
    });

    await accountLogs.save(accountLogs);

    res.status(200).json({
      message: "Merchant blocked",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Add Merchants by CSV
const addMerchantsFromCSVController = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(appError("CSV file is required", 400));
    }

    // Upload the CSV file to Firebase and get the download URL
    const fileUrl = await uploadToFirebase(req.file, "csv-uploads");

    const merchants = [];

    // Download the CSV data from Firebase Storage
    const response = await axios.get(fileUrl);
    const csvData = response.data;

    // Create a readable stream from the CSV data
    const stream = Readable.from(csvData);

    // Parse the CSV data
    stream
      .pipe(csvParser())
      .on("data", (row) => {
        const isRowEmpty = Object.values(row).every(
          (value) => value.trim() === ""
        );

        if (!isRowEmpty) {
          const location = row["Location"] ? row["Location"].split(",") : null;

          let latitude, longitude;
          if (location && location.length === 2) {
            latitude = parseFloat(location[0].trim());
            longitude = parseFloat(location[1].trim());
          }

          const merchant = {
            fullName: row["Full name of owner"]?.trim() || "-",
            merchantName: row["Merchant name"]?.trim(),
            email: row.Email?.toLowerCase().trim(),
            phoneNumber: row["Phone number"]?.trim(),
            password: row.Password?.trim() || "12345678",
            location: latitude && longitude ? [latitude, longitude] : [],
          };

          // Validate required fields
          if (!merchant.email && !merchant.phoneNumber) {
            return next(appError("Either email or phoneNumber is required."));
          }

          merchants.push(merchant);
        }
      })
      .on("end", async () => {
        try {
          const merchantPromise = merchants.map(async (merchantData) => {
            // Check if the merchant already exists by email or phone number
            const existingMerchant = await Merchant.findOne({
              $or: [
                { email: merchantData.email },
                { phoneNumber: merchantData.phoneNumber },
              ],
            });

            if (existingMerchant) {
              // Prepare the update object
              const updateData = {};

              // Update only the provided fields
              if (merchantData.fullName)
                updateData.fullName = merchantData.fullName;
              if (merchantData.merchantName)
                updateData["merchantDetail.merchantName"] =
                  merchantData.merchantName;
              if (merchantData.email) updateData.email = merchantData.email;
              if (merchantData.phoneNumber)
                updateData.phoneNumber = merchantData.phoneNumber;
              if (merchantData.location)
                updateData["merchantDetail.location"] = merchantData.location;

              const salt = await bcrypt.genSalt(10);
              updateData.password = await bcrypt.hash(
                merchantData.password,
                salt
              );

              // Update existing merchant with only the new fields
              await Merchant.findByIdAndUpdate(
                existingMerchant._id,
                { $set: updateData },
                { new: true }
              );
            } else {
              // Hash password for new merchant
              const salt = await bcrypt.genSalt(10);
              const hashedPassword = await bcrypt.hash(
                merchantData.password,
                salt
              );

              // Create new merchant
              const merchant = new Merchant({
                ...merchantData,
                merchantDetail: {
                  merchantName: merchantData.merchantName,
                  location: merchantData.location,
                },
                password: hashedPassword,
              });

              return merchant.save();
            }
          });

          await Promise.all(merchantPromise);

          res.status(200).json({
            message: "Merchants added/updated successfully.",
          });
        } catch (err) {
          next(appError(err.message));
        } finally {
          // Delete the file from Firebase after processing
          await deleteFromFirebase(fileUrl);
        }
      })
      .on("error", (error) => {
        next(appError(error.message));
      });
  } catch (err) {
    next(appError(err.message));
  }
};

// Download sample CSV
const downloadMerchantSampleCSVController = async (req, res, next) => {
  try {
    // Define the path to your sample CSV file
    const filePath = path.join(__dirname, "../../../sample_CSV/sample_CSV.csv");

    // Define the headers and data for the CSV
    const csvHeaders = [
      { id: "fullName", title: "Full name of owner" },
      { id: "merchantName", title: "Merchant name" },
      { id: "email", title: "Email" },
      { id: "phoneNumber", title: "Phone number" },
      { id: "password", title: "Password" },
      { id: "location", title: "Location" },
    ];

    const csvData = [
      {
        fullName: "John Doe",
        merchantName: "Shop name",
        email: "john.doe@example.com",
        phoneNumber: "1234567890",
        password: "12345678",
        location: "x.xxxxx, xx.xxxxx",
      },
      {
        fullName: "Jane Smith",
        merchantName: "Shop name",
        email: "jane.smith@example.com",
        phoneNumber: "1234567890",
        password: "12345678",
        location: "x.xxxxx, xx.xxxxx",
      },
    ];

    // Create a new CSV writer
    const writer = csvWriter({
      path: filePath,
      header: csvHeaders,
    });

    // Write the data to the CSV file
    await writer.writeRecords(csvData);

    // Send the CSV file as a response for download
    res.download(filePath, "Merchant_sample.csv", (err) => {
      if (err) {
        next(err);
      }
    });
  } catch (error) {
    res.status(500).send("Error processing the CSV file");
  }
};

// Download merchant CSV
const downloadMerchantCSVController = async (req, res, next) => {
  try {
    const { serviceable, geofence, businessCategory, searchFilter } = req.query;

    // Build query object based on filters
    const filter = {};
    if (serviceable && serviceable !== "All")
      filter.isServiceableToday = serviceable?.trim();
    if (geofence && geofence !== "All")
      filter["merchantDetai.geofenceId"] = geofence?.trim();
    if (businessCategory && businessCategory !== "All")
      filter["merchantDetai.businessCategoryId"] = businessCategory?.trim();
    if (searchFilter) {
      filter.$or = [
        {
          "merchantDetail.merchantName": {
            $regex: searchFilter,
            $options: "i",
          },
        },
      ];
    }

    // Fetch the data based on filter (get both approved and pending agents)
    let allMerchants = await Merchant.find(filter)
      .populate("merchantDetail.geofenceId", "name")
      .populate("merchantDetail.businessCategoryId", "title")
      .sort({ createdAt: -1 })
      .exec();

    let formattedResponse = [];

    // Collect all agents in one array
    allMerchants?.forEach((merchant) => {
      formattedResponse.push({
        merchantId: merchant?._id || "-",
        merchantName: merchant?.merchantDetail?.merchantName || "-",
        fullName: merchant?.fullName || "-",
        merchantEmail: merchant?.email || "-",
        phoneNumber: merchant?.phoneNumber || "-",
        registrationStatus: merchant?.isApproved || "-",
        currentStatus: merchant?.status ? "Open" : "Closed",
        isBlocked: merchant?.isBlocked ? "True" : "False",
        reasonForBlockingOrDeleting:
          merchant?.reasonForBlockingOrDeleting || "-",
        blockedDate: merchant?.blockedDate
          ? formatDate(merchant?.blockedDate)
          : "-",
        merchantImageURL: merchant?.merchantDetail?.merchantImageURL || "-",
        displayAddress: merchant?.merchantDetail?.displayAddress || "-",
        description: merchant?.merchantDetail?.description || "-",
        geofence: merchant?.merchantDetail?.geofenceId?.name || "-",
        businessCategory:
          merchant?.merchantDetail?.businessCategoryId?.title || "-",
        pancardNumber: merchant?.merchantDetail?.pancardNumber || "-",
        pancardImageURL: merchant?.merchantDetail?.pancardImageURL || "-",
        GSTINNumber: merchant?.merchantDetail?.GSTINNumber || "-",
        GSTINImageURL: merchant?.merchantDetail?.GSTINImageURL || "-",
        FSSAINumber: merchant?.merchantDetail?.FSSAINumber || "-",
        FSSAIImageURL: merchant?.merchantDetail?.FSSAIImageURL || "-",
        aadharNumber: merchant?.merchantDetail?.aadharNumber || "-",
        aadharImageURL: merchant?.merchantDetail?.aadharImageURL || "-",
        merchantFoodType: merchant?.merchantDetail?.merchantFoodType || "-",
        deliveryOption: merchant?.merchantDetail?.deliveryOption || "-",
        deliveryTime: merchant?.merchantDetail?.deliveryTime || "-",
        preOrderStatus: merchant?.merchantDetail?.preOrderStatus || "-",
        servingArea: merchant?.merchantDetail?.servingArea || "-",
        servingRadius: merchant?.merchantDetail?.servingRadius || "-",
      });
    });

    const filePath = path.join(__dirname, "../../../sample_CSV/sample_CSV.csv");

    const csvHeaders = [
      { id: "merchantId", title: "Merchant ID" },
      { id: "merchantName", title: "Merchant Name" },
      { id: "fullName", title: "Full Name" },
      { id: "merchantEmail", title: "Merchant Email" },
      { id: "phoneNumber", title: "Phone Number" },
      { id: "registrationStatus", title: "Registration Status" },
      { id: "currentStatus", title: "Current Status" },
      { id: "isBlocked", title: "Is Blocked" },
      {
        id: "reasonForBlockingOrDeleting",
        title: "Reason for Blocking/Deleting",
      },
      { id: "blockedDate", title: "Blocked Date" },
      { id: "merchantImageURL", title: "Merchant Image URL" },
      { id: "displayAddress", title: "Display Address" },
      { id: "description", title: "Description" },
      { id: "geofence", title: "Geofence" },
      { id: "businessCategory", title: "Business Category" },
      { id: "pancardNumber", title: "PAN Card Number" },
      { id: "pancardImageURL", title: "PAN Card Image URL" },
      { id: "GSTINNumber", title: "GSTIN Number" },
      { id: "GSTINImageURL", title: "GSTIN Image URL" },
      { id: "FSSAINumber", title: "FSSAI Number" },
      { id: "FSSAIImageURL", title: "FSSAI Image URL" },
      { id: "aadharNumber", title: "Aadhar Number" },
      { id: "aadharImageURL", title: "Aadhar Image URL" },
      { id: "merchantFoodType", title: "Merchant Food Type" },
      { id: "deliveryOption", title: "Delivery Option" },
      { id: "deliveryTime", title: "Delivery Time" },
      { id: "preOrderStatus", title: "Pre-Order Status" },
      { id: "servingArea", title: "Serving Area" },
      { id: "servingRadius", title: "Serving Radius" },
    ];

    const writer = csvWriter({
      path: filePath,
      header: csvHeaders,
    });

    await writer.writeRecords(formattedResponse);

    res.status(200).download(filePath, "Merchant_Data.csv", (err) => {
      if (err) {
        next(err);
      }
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Delete merchant profile
const deleteMerchantProfileByAdminController = async (req, res, next) => {
  try {
    const { merchantId } = req.params;

    // Step 1: Find the merchant
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) return next(appError("Merchant not found", 404));

    // Step 2: Find all categories and products of the merchant
    const categories = await Category.find({ merchantId });
    const products = await Product.find({ merchantId });

    // Step 3: Delete associated images from Firebase
    const deleteCategoryImagesPromises = categories
      .filter((category) => category.categoryImageURL) // Filter categories with images
      .map((category) => deleteFromFirebase(category?.categoryImageURL));

    const deleteProductImagesPromises = products
      .filter((product) => product.productImageURL) // Filter products with images
      .map((product) => deleteFromFirebase(product?.productImageURL));

    const deleteMerchantImagesPromises = [
      merchant?.merchantDetail?.merchantImageURL,
      merchant?.merchantDetail?.pancardImageURL,
      merchant?.merchantDetail?.GSTINImageURL,
      merchant?.merchantDetail?.FSSAIImageURL,
      merchant?.merchantDetail?.aadharImageURL,
    ]
      .filter((url) => url) // Filter merchant images with URLs
      .map((url) => deleteFromFirebase(url));

    // Execute all image deletion promises in parallel
    await Promise.all([
      ...deleteCategoryImagesPromises,
      ...deleteProductImagesPromises,
      ...deleteMerchantImagesPromises,
    ]);

    // Step 4: Delete products and categories
    await Product.deleteMany({ merchantId });
    await Category.deleteMany({ merchantId });

    // Step 5: Delete the merchant
    await Merchant.findByIdAndDelete(merchantId);

    res.status(200).json({
      message: "Merchant and associated data deleted successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get merchant payout
const getMerchantPayoutController = async (req, res, next) => {
  try {
    let {
      page = 1,
      limit = 50,
      paymentStatus,
      merchantId,
      geofenceId,
      startDate,
      query,
      endDate,
      isPaginated = "true",
    } = req.query;

    isPaginated = isPaginated === "true";
    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    // Calculate the number of documents to skip
    const skip = (page - 1) * limit;

    const filterCriteria = {
      "payoutDetail.0": { $exists: true }, // Only merchants with at least one payoutDetail
    };

    if (query && query !== "")
      filterCriteria["merchantDetail.merchantName"] = {
        $regex: query,
        $options: "i",
      };

    // Set filter criteria based on query parameters
    if (paymentStatus && paymentStatus !== "all") {
      filterCriteria["payoutDetail.isSettled"] =
        paymentStatus.toLowerCase() === "true";
    }

    if (merchantId && merchantId !== "all") filterCriteria["_id"] = merchantId;

    if (geofenceId && geofenceId !== "all")
      filterCriteria["merchantDetail.geofenceId"] =
        mongoose.Types.ObjectId.createFromHexString(geofenceId);

    if (startDate || endDate) {
      filterCriteria["payoutDetail.date"] = {};
      if (startDate) {
        startDate = new Date(startDate);
        startDate.setHours(18, 30, 0, 0);
        filterCriteria["payoutDetail.date"].$gte = startDate;
      }
      if (endDate) {
        endDate = new Date(endDate);
        endDate.setHours(18, 29, 59, 999);
        filterCriteria["payoutDetail.date"].$lte = endDate;
      }
    }

    // Query the Merchant model with filter criteria
    const merchantPayoutQuery = Merchant.find(filterCriteria, {
      payoutDetail: 1,
      phoneNumber: 1,
      "merchantDetail.merchantName": 1,
    });

    // Apply pagination if required
    if (isPaginated) {
      merchantPayoutQuery.skip(skip).limit(limit);
    }

    const merchants = await merchantPayoutQuery;

    // Flatten the response to get only payout details
    const data = merchants.flatMap((merchant) => {
      return merchant.payoutDetail.map((payout) => ({
        merchantId: merchant._id,
        merchantName: merchant.merchantDetail.merchantName,
        phoneNumber: merchant.phoneNumber,
        date: formatDate(payout.date),
        totalCostPrice: payout.totalCostPrice,
        completedOrders: payout.completedOrders,
        isSettled: payout.isSettled,
        payoutId: payout.payoutId,
      }));
    });

    res.status(200).json({
      data,
      pagination: isPaginated
        ? {
            page,
            limit,
            total: data.length,
          }
        : null,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getMerchantPayoutDetail = async (req, res, next) => {
  try {
    const { date, merchantId } = req.query;

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Find all completed orders for the specified merchant on the given day
    const allOrders = await Order.find({
      merchantId,
      status: "Completed",
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    })
      .select("purchasedItems")
      .lean();

    // Initialize an array to store the processed data
    const processedItems = [];

    // Iterate through each order's purchased items
    for (const order of allOrders) {
      for (const item of order.purchasedItems) {
        const product = await Product.findById(item.productId)
          .select("productName costPrice price variants")
          .lean();
        if (!product) continue;

        const productName = product.productName;

        // Initialize variables for price and costPrice based on whether a variant exists
        let price = item.price || product.price;
        let costPrice = item.costPrice || product.costPrice;
        let variantName = null;

        if (item.variantId) {
          // Find the matching variant type
          const variant = product.variants
            .flatMap((v) => v.variantTypes)
            .find(
              (vType) => vType._id.toString() === item.variantId.toString()
            );
          if (variant) {
            variantName = variant.typeName;
            price = variant.price;
            costPrice = variant.costPrice;
          }
        }

        // Calculate total cost for the item
        const totalCost = item.quantity * costPrice;

        // Push the formatted item data to the processedItems array
        processedItems.push({
          productName,
          variantName,
          costPrice,
          price,
          quantity: item.quantity,
          totalCost,
        });
      }
    }

    res.status(200).json({
      data: processedItems,
    });
  } catch (err) {
    next(new Error(`Error retrieving merchant payout details: ${err.message}`));
  }
};

const comfirmMerchantPayout = async (req, res, next) => {
  try {
    const { payoutId, merchantId } = req.params;

    const merchantFound = await Merchant.findById(merchantId)
      .select("payoutDetail")
      .lean();

    if (!merchantFound) return next(appError("Merchant not found", 404));

    const paymentDetailFound = merchantFound.payoutDetail.filter(
      (merchantPayout) => merchantPayout.payoutId.toString() === payoutId
    );

    if (!paymentDetailFound)
      return next(appError("Payment detail not found", 404));

    paymentDetailFound.isSettled = true;

    await merchantFound.save();

    res.status(200).json({ message: "Payment settled successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  registerMerchantController,
  getMerchantProfileController,
  editMerchantProfileController,
  changeMerchantStatusByMerchantController,
  updateMerchantDetailsByMerchantController,
  sponsorshipPaymentByMerchantController,
  verifyPaymentByMerchantController,
  updateMerchantDetailsController,
  searchMerchantController,
  getRatingsAndReviewsByCustomerController,
  getAllMerchantsController,
  getSingleMerchantController,
  changeMerchantStatusController,
  approveRegistrationController,
  rejectRegistrationController,
  sponsorshipPaymentController,
  verifyPaymentController,
  blockMerchant,
  addMerchantController,
  editMerchantController,
  filterMerchantsController,
  addMerchantsFromCSVController,
  downloadMerchantSampleCSVController,
  downloadMerchantCSVController,
  deleteMerchantProfileByAdminController,
  getAllMerchantsForDropDownController,
  changeMerchantStatusByMerchantControllerForToggle,
  getMerchantPayoutController,
  getMerchantPayoutDetail,
  comfirmMerchantPayout,
};
