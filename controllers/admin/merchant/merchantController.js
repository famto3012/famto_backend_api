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
    console.log("Request", req);
    const merchantId = req.userAuth;

    console.log("merchantId print", merchantId);

    const merchantFound = await Merchant.findOne({ _id: merchantId });

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
      ...merchantDetail,
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

    const searchTerm = query.toLowerCase();

    const searchResults = await Merchant.find({
      "merchantDetail.merchantName": { $regex: searchTerm, $options: "i" },
    }).select("merchantDetail.merchantName phoneNumber isApproved");

    const merchantsWithDetails = await Promise.all(
      searchResults.map(async (merchant) => {
        // Fetch additional details if available, or set them to null if not
        let merchantDetail = await Merchant.findById(merchant._id)
          .select(
            "status merchantDetail.merchantName merchantDetail.geofenceId merchantDetail.averageRating merchantDetail.isServiceableToday"
          )
          .populate("merchantDetail.geofenceId", "name");

        return {
          _id: merchant._id,
          merchantName:
            merchant?.merchantDetail?.merchantName ||
            merchant.fullName ||
            "N/A",
          phoneNumber: merchant.phoneNumber,
          isApproved: merchant.isApproved,
          status: merchantDetail ? merchantDetail.status : "N/A",
          geofence: merchantDetail //&& merchantDetail?.merchantDetail?.geofenceId
            ? merchantDetail.merchantDetail?.geofenceId.name
            : "N/A",
          averageRating: merchantDetail // && merchantDetail?.merchantDetail
            ? merchantDetail?.merchantDetail?.averageRating
            : "0",
          isServiceableToday: merchantDetail // && merchantDetail.merchantDetail
            ? merchantDetail.merchantDetail.isServiceableToday
            : "N/A",
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

// Filter merchant
const filterMerchantsController = async (req, res, next) => {
  try {
    const { serviceable, businessCategory, geofence } = req.query;

    // Validate query parameters
    if (!serviceable && !businessCategory && !geofence) {
      return res
        .status(400)
        .json({ message: "At least one filter is required" });
    }

    const filterCriteria = {};

    // Add filters based on query parameters
    if (serviceable) {
      if (!["open", "closed"].includes(serviceable.toLowerCase())) {
        return res.status(400).json({ message: "Invalid serviceable value" });
      }
    }

    if (businessCategory) {
      try {
        filterCriteria["merchantDetail.businessCategoryId"] =
          new mongoose.Types.ObjectId(businessCategory.trim());
      } catch (err) {
        return res
          .status(400)
          .json({ message: "Invalid business category ID" });
      }
    }

    if (geofence) {
      try {
        filterCriteria["merchantDetail.geofenceId"] =
          new mongoose.Types.ObjectId(geofence.trim());
      } catch (err) {
        return res.status(400).json({ message: "Invalid geofence ID" });
      }
    }

    // Fetch merchants based on the constructed filter criteria
    const merchants = await Merchant.find(filterCriteria)
      .populate("merchantDetail.geofenceId")
      .populate("merchantDetail.businessCategoryId");

    // Filter merchants based on the serviceable virtual field if specified
    const filteredMerchants = serviceable
      ? merchants.filter((merchant) => {
          return (
            merchant?.merchantDetail?.isServiceableToday ===
            serviceable.toLowerCase()
          );
        })
      : merchants;

    const merchantsWithDetails = filteredMerchants.map((merchant) => {
      const merchantDetail = merchant.merchantDetail;
      return {
        _id: merchant._id,
        merchantName: merchantDetail?.merchantName || "N/A",
        phoneNumber: merchant.phoneNumber,
        status: merchant.status,
        isApproved: merchant.isApproved,
        subscriptionStatus:
          merchant?.sponsorshipDetail?.length > 0 ? "Active" : "Inactive",
        geofence:
          merchantDetail && merchantDetail.geofenceId
            ? merchantDetail.geofenceId.name
            : null,
        averageRating: merchantDetail ? merchantDetail.averageRating : 0,
        isServiceableToday:
          merchant.merchantDetail?.isServiceableToday || "N/A",
      };
    });

    res.status(200).json({
      message: "Filtered merchants",
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
    const merchantsFound = await Merchant.find({ isBlocked: false })
      .select("fullName phoneNumber isApproved status merchantDetail")
      .populate("merchantDetail.geofenceId", "name");

    const merchantsWithDetails = merchantsFound.map((merchant) => {
      const geofenceName = merchant?.merchantDetail?.geofenceId
        ? merchant.merchantDetail.geofenceId.name
        : "N/A";

      // Access isServiceableToday directly as it's a virtual field
      const isServiceableToday = merchant.merchantDetail?.isServiceableToday;

      return {
        _id: merchant._id,
        merchantName: merchant?.merchantDetail?.merchantName || "N/A",
        phoneNumber: merchant.phoneNumber,
        isApproved: merchant.isApproved,
        status: merchant.status && isServiceableToday === "open" ? true : false,
        geofence: geofenceName,
        averageRating: merchant?.merchantDetail?.averageRating,
        isServiceableToday:
          isServiceableToday === "open" && merchant.status ? "open" : "closed",
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
      .populate("merchantDetail.geofenceId", "name _id")
      .populate("merchantDetail.businessCategoryId")
      .populate("merchantDetail.pricing")
      .select("-password")
      .lean({ virtuals: true });

    if (!merchantFound) {
      return next(appError("Merchant not found", 404));
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
          geofenceId: merchantFound?.merchantDetail?.geofenceId?._id || "", // Extract name
          businessCategoryId:
            merchantFound?.merchantDetail?.businessCategoryId?._id || "",
        } || {},
      sponsorshipDetail: merchantFound?.sponsorshipDetail[0] || [],
      pricing: merchantFound?.merchantDetail?.pricing?.[0] || {},
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

    res.status(201).json({ message: "Merchant added successfully" });
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
      ...merchantDetail,
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

// Block a merchant
const blockMerchant = async (req, res, next) => {
  try {
    const { merchantId } = req.params;
    const { reasonForBlocking } = req.body;

    const merchantFound = await Merchant.findById(merchantId);

    console.log(merchantFound);

    if (merchantFound.isBlocked) {
      res.status(200).json({
        message: "Merchant is already blocked",
      });
    } else {
      merchantFound.isBlocked = true;
      merchantFound.reasonForBlockingOrDeleting = reasonForBlocking;
      merchantFound.blockedDate = new Date();
      await merchantFound.save();

      console.log("here");

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
};
