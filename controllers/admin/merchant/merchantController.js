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
const { default: mongoose } = require("mongoose");

//----------------------------
//For Merchant
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

//Change status by merchant
const changeMerchantStatusByMerchantController = async (req, res, next) => {
  try {
    const merchantFound = await Merchant.findById(req.userAuth);

    if (!merchantFound) {
      return next(appError("Merchant not found", 404));
    }

    merchantFound.status = !merchantFound.status;
    await merchantFound.save();

    res.status(200).json({ message: "Merchant status changed" });
  } catch (err) {
    next(appError(err.message));
  }
};

//Update Merchant Details by merchant
const updateMerchantDetailsByMerchantController = async (req, res, next) => {
  const {
    fullName,
    email,
    phoneNumber,
    merchantName,
    displayAddress,
    description,
    geofenceId,
    location,
    pancardNumber,
    GSTINNumber,
    FSSAINumber,
    aadharNumber,
    businessCategoryId,
    deliveryOption,
    deliveryTime,
    servingArea,
    availability,
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
    const merchantId = req.userAuth;

    const merchantFound = await Merchant.findById(merchantId);

    if (!merchantFound) {
      return next(appError("Merchant not found", 404));
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

    const details = {
      merchantName,
      displayAddress,
      description,
      geofenceId,
      location,
      pancardNumber,
      GSTINNumber,
      FSSAINumber,
      aadharNumber,
      businessCategoryId,
      deliveryOption,
      deliveryTime,
      servingArea,
      availability,
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
//For Admin Panel
//-----------------------------

// Search merchant
const searchMerchantController = async (req, res, next) => {
  try {
    const { query } = req.query;

    if (!query || query.trim() === "") {
      return res.status(400).json({
        message: "Search query cannot be empty",
      });
    }

    const searchResults = await Merchant.find({
      fullName: { $regex: searchTerm, $options: "i" },
    }).select("fullName phoneNumber isApproved");

    const merchantsWithDetails = await Promise.all(
      searchResults.map(async (merchant) => {
        // Fetch additional details if available, or set them to null if not
        let merchantDetail = await Merchant.findById(merchant._id)
          .select(
            "status merchantDetail.geofenceId merchantDetail.averageRating merchantDetail.isServiceableToday"
          )
          .populate("merchantDetail.geofenceId", "name");

        return {
          ...merchant.toObject(),
          status: merchantDetail ? merchantDetail.status : null,
          geofence:
            merchantDetail && merchantDetail?.merchantDetail?.geofenceId
              ? merchantDetail.merchantDetail?.geofenceId.name
              : null,
          averageRating:
            merchantDetail && merchantDetail.merchantDetail
              ? merchantDetail.merchantDetail.averageRating
              : null,
          isServiceableToday:
            merchantDetail && merchantDetail.merchantDetail
              ? merchantDetail.merchantDetail.isServiceableToday
              : null,
        };
      })
    );

    res.status(200).json({
      message: "Searched merchant results",
      data: merchantsWithDetails,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

//TODO: Need to work on
// Filter merchant by serviceable
const filterMerchantByServiceableController = async (req, res, next) => {
  try {
    const { filter } = req.query;

    if (!filter || (filter !== "open" && filter !== "closed")) {
      return res.status(400).json({
        message: "Filter query must be 'open' or 'closed'",
      });
    }

    const merchantsFound = await Merchant.find({})
      .select("fullName phoneNumber isApproved merchantDetail")
      .populate("merchantDetail.geofenceId", "name");

    const filteredMerchants = merchantsFound.filter((merchant) => {
      const merchantDetail = merchant.merchantDetail;

      if (!merchantDetail || !merchantDetail.availability)
        return filter === "closed";

      const today = new Date()
        .toLocaleString("en-US", { weekday: "long" })
        .toLowerCase();
      const todayAvailability = merchantDetail.availability.specificDays[today];

      if (!todayAvailability) return filter === "closed";

      if (todayAvailability.openAllDay) return filter === "open";
      if (todayAvailability.closedAllDay) return filter === "closed";

      if (
        todayAvailability.specificTime &&
        todayAvailability.startTime &&
        todayAvailability.endTime
      ) {
        const now = new Date();
        const [startHour, startMinute] = todayAvailability.startTime
          .split(":")
          .map(Number);
        const [endHour, endMinute] = todayAvailability.endTime
          .split(":")
          .map(Number);

        const startTime = new Date(now.setHours(startHour, startMinute, 0));
        const endTime = new Date(now.setHours(endHour, endMinute, 0));

        const isOpen = now >= startTime && now <= endTime;
        return filter === "open" ? isOpen : !isOpen;
      }

      return filter === "closed";
    });

    const merchantsWithDetails = filteredMerchants.map((merchant) => {
      const merchantDetail = merchant.merchantDetail;
      return {
        ...merchant.toObject(),
        status: merchantDetail ? merchantDetail.status : null,
        geofence:
          merchantDetail && merchantDetail.geofenceId
            ? merchantDetail.geofenceId.name
            : null,
        averageRating: merchantDetail ? merchantDetail.averageRating : null,
        isServiceableToday: merchantDetail
          ? merchantDetail.isServiceableToday
          : null,
      };
    });

    res.status(200).json({
      message: "Filtered merchant results",
      data: merchantsWithDetails,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Filter merchant by business category
const filterMerchantByBusinessCategoryController = async (req, res, next) => {
  try {
    const { filter } = req.query;

    if (!filter) {
      return res.status(400).json({ message: "Business category is required" });
    }

    // Convert geofence query parameter to ObjectId
    const businessCategoryObjectId = new mongoose.Types.ObjectId(filter.trim());

    const searchResults = await Merchant.find(
      { "merchantDetail.businessCategoryId": businessCategoryObjectId },
      // Specifying the fields needed to include in the response
      "_id fullName email phoneNumber status isApproved"
    );

    const merchantsWithDetails = await Promise.all(
      searchResults.map(async (merchant) => {
        // Fetch additional details if available, or set them to null if not
        let merchantDetail = await Merchant.findById(merchant._id).select(
          "merchantDetail.isServiceableToday"
        );

        return {
          ...merchant.toObject(),
          isServiceableToday:
            merchantDetail && merchantDetail.merchantDetail
              ? merchantDetail.merchantDetail.isServiceableToday
              : "unknown",
        };
      })
    );

    res.status(200).json({
      message: "Filtering merchants by geofence",
      data: merchantsWithDetails,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Filter merchant by geofence
const filterMerchantByGeofenceController = async (req, res, next) => {
  try {
    const { filter } = req.query;

    if (!filter) {
      return res.status(400).json({ message: "Geofence is required" });
    }

    // Convert geofence query parameter to ObjectId
    const geofenceObjectId = new mongoose.Types.ObjectId(filter.trim());

    const searchResults = await Merchant.find(
      { "merchantDetail.geofenceId": geofenceObjectId },
      // Specifying the fields needed to include in the response
      "_id fullName email phoneNumber status isApproved"
    );

    const merchantsWithDetails = await Promise.all(
      searchResults.map(async (merchant) => {
        // Fetch additional details if available, or set them to null if not
        let merchantDetail = await Merchant.findById(merchant._id).select(
          "merchantDetail.isServiceableToday"
        );

        return {
          ...merchant.toObject(),
          isServiceableToday:
            merchantDetail && merchantDetail.merchantDetail
              ? merchantDetail.merchantDetail.isServiceableToday
              : "unknown",
        };
      })
    );

    res.status(200).json({
      message: "Filtering merchants by geofence",
      data: merchantsWithDetails,
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

    await Merchant.findByIdAndDelete(req.params.merchantId);

    res.status(200).json({
      message: "Declined merchant registration",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get all merchant details
const getAllMerchantsController = async (req, res, next) => {
  try {
    const merchantsFound = await Merchant.find({})
      .select("fullName phoneNumber isApproved status merchantDetail")
      .populate("merchantDetail.geofenceId", "name");

    const merchantsWithDetails = merchantsFound.map((merchant) => {
      const geofenceName = merchant?.merchantDetail?.geofenceId
        ? merchant.merchantDetail.geofenceId.name
        : null;

      // Access isServiceableToday directly as it's a virtual field
      const isServiceableToday = merchant.merchantDetail?.isServiceableToday;

      return {
        _id: merchant._id,
        fullName: merchant.fullName,
        phoneNumber: merchant.phoneNumber,
        isApproved: merchant.isApproved,
        status: merchant.status,
        geofence: geofenceName,
        averageRating: merchant?.merchantDetail?.averageRating,
        isServiceableToday: isServiceableToday,
      };
    });

    res.status(200).json({
      message: "Getting all merchants",
      data: merchantsWithDetails,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get single merchant detail by Id
const getSingleMerchantController = async (req, res, next) => {
  try {
    const merchantFound = await Merchant.findById(req.params.merchantId)
      .populate("merchantDetail.geofenceId", "name")
      .populate("merchantDetail.businessCategoryId", "title");

    if (!merchantFound) {
      return next(appError("Merchant not found", 404));
    }

    // Convert the document to an object including virtuals
    const merchantWithVirtuals = merchantFound.toObject({ virtuals: true });

    // Extract the first sponsorship detail
    const firstSponsorshipDetail = merchantFound.sponsorshipDetail
      ? merchantFound.sponsorshipDetail[0]
      : null;

    res.status(200).json({
      message: "Merchant details",
      data: {
        ...merchantWithVirtuals,
        sponsorshipDetail: firstSponsorshipDetail
          ? [firstSponsorshipDetail]
          : [],
      },
    });
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

    merchantFound.status = !merchantFound.status;
    await merchantFound.save();

    res.status(200).json({ message: "Merchant status changed" });
  } catch (err) {
    next(appError(err.message));
  }
};

// Update Merchant Details by admin
const updateMerchantDetailsController = async (req, res, next) => {
  const {
    fullName,
    email,
    phoneNumber,
    merchantName,
    displayAddress,
    description,
    geofenceId,
    location,
    pancardNumber,
    GSTINNumber,
    FSSAINumber,
    aadharNumber,
    businessCategoryId,
    deliveryOption,
    deliveryTime,
    servingArea,
    availability,
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
    const { merchantId } = req.params;

    const merchantFound = await Merchant.findById(merchantId);

    if (!merchantFound) {
      return next(appError("Merchant not found", 404));
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

    const details = {
      merchantName,
      displayAddress,
      description,
      geofenceId,
      location,
      pancardNumber,
      GSTINNumber,
      FSSAINumber,
      aadharNumber,
      businessCategoryId,
      deliveryOption,
      deliveryTime,
      servingArea,
      availability,
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

    res.status(200).json({ message: "Merchant details added successfully" });
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

module.exports = {
  registerMerchantController,
  changeMerchantStatusByMerchantController,
  updateMerchantDetailsByMerchantController,
  sponsorshipPaymentByMerchantController,
  verifyPaymentByMerchantController,
  updateMerchantDetailsController,
  searchMerchantController,
  filterMerchantByServiceableController,
  filterMerchantByGeofenceController,
  filterMerchantByBusinessCategoryController,
  getRatingsAndReviewsByCustomerController,
  getAllMerchantsController,
  getSingleMerchantController,
  changeMerchantStatusController,
  approveRegistrationController,
  rejectRegistrationController,
  sponsorshipPaymentController,
  verifyPaymentController,
};
