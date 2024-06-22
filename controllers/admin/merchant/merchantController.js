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
const calculateEndDate = require("../../../utils/calculateEndDate");

//Register
const registerMerchantController = async (req, res, next) => {
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

//----------------------------
//For Admin Panel
//-----------------------------
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

const getAllMerchantsController = async (req, res, next) => {
  try {
    const merchantsFound = await Merchant.find({}).select(
      "fullName phoneNumber isApproved"
    );

    const merchantsWithDetails = await Promise.all(
      merchantsFound.map(async (merchant) => {
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
      message: "Getting all merchants",
      data: merchantsWithDetails,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getSingleMerchantController = async (req, res, next) => {
  try {
    const merchantFound = await Merchant.findById(req.params.merchantId);

    if (!merchantFound) {
      return next(appError("Merchant not found", 404));
    }

    res.status(200).json({
      message: "Merchant details",
      data: merchantFound,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

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
      const startDate = new Date();
      const endDate = calculateEndDate(startDate, currentPlan);

      merchantFound.sponsorshipDetail = {
        sponsorshipStatus: true,
        currentPlan,
        startDate,
        endDate,
        paymentDetails,
      };

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

const getPlanAmount = (plan) => {
  switch (plan) {
    case "Monthly":
      return 250;
    case "3 Month":
      return 750;
    case "6 Month":
      return 1500;
    case "1 Year":
      return 3000;
    default:
      throw new Error("Invalid plan");
  }
};

module.exports = {
  registerMerchantController,
  updateMerchantDetailsController,
  getAllMerchantsController,
  getSingleMerchantController,
  approveRegistrationController,
  rejectRegistrationController,
  sponsorshipPaymentController,
  verifyPaymentController,
};
