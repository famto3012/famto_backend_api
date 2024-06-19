const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const appError = require("../../../utils/appError");
const {
  uploadToFirebase,
  deleteFromFirebase,
} = require("../../../utils/imageOperation");
const MerchantDetails = require("../../../models/Merchant");
const Merchant = require("../../../models/Merchant");
const calculateDateRange = require("../../../utils/calculateSponsorshipDateRange");
const { verifyRazorpayPayment } = require("../../../utils/razorpayPayment");

//Register
const registerMerchantController = async (req, res, next) => {
  try {
    const { fullName, email, phoneNumber, password } = req.body;

    const normalizedEmail = email.toLowerCase();

    const merchantExists = await Merchant.findOne({ email: normalizedEmail });

    if (merchantExists) {
      return res.status(400).json({ error: "Email already exists" });
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
        success: "User created successfully",
        _id: newMerchant._id,
        fullName: newMerchant.fullName,
        email: newMerchant.email,
        phoneNumber: newMerchant.phoneNumber,
      });
    } else {
      res.status(400).json({ error: "Invalid user data received" });
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

    merchantFound.isApproved = true;
    await merchantFound.save();

    res.status(200).json({
      message: "Approved merchanr registration",
      data: merchantFound,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const declineRegistrationController = async (req, res, next) => {
  try {
    const merchantFound = await Merchant.findById(req.params.merchantId);

    if (!merchantFound) {
      return next(appError("Merchant not found", 404));
    }

    merchantFound.isApproved = false;
    await merchantFound.save();

    res.status(200).json({
      message: "Declined merchant registration",
      data: merchantFound,
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
  const merchantDetail = req.body;

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

    const updatedMerchant = await Merchant.findByIdAndUpdate(
      merchantId,
      { merchantDetail: details },
      { new: true, runValidators: true }
    );

    if (!updatedMerchant) {
      return next(appError("Error in adding merchant details"));
    }

    res.status(200).json({ message: "Merchant details added successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  registerMerchantController,
  updateMerchantDetailsController,
  getAllMerchantsController,
  getSingleMerchantController,
  approveRegistrationController,
  declineRegistrationController,
  // editMerchantController,
};

// const addMerchantController = async (req, res, next) => {
//   const {
//     merchantName,
//     displayAddress,
//     description,
//     geofence,
//     location,
//     pricing,
//     pancardNumber,
//     GSTINNumber,
//     FSSAINumber,
//     aadharNumber,
//     deliveryOption,
//     deliveryTime,
//     servingArea,
//     availability,
//   } = req.body;

//   const errors = validationResult(req);

//   let formattedErrors = {};
//   if (!errors.isEmpty()) {
//     errors.array().forEach((error) => {
//       formattedErrors[error.path] = error.msg;
//     });
//     return res.status(500).json({ errors: formattedErrors });
//   }

//   try {
//     let merchantImageURL = "";
//     let pancardImageURL = "";
//     let GSTINImageURL = "";
//     let FSSAIImageURL = "";
//     let aadharImageURL = "";

//     if (req.files) {
//       const {
//         merchantImage,
//         pancardImage,
//         GSTINImage,
//         FSSAIImage,
//         aadharImage,
//       } = req.files;

//       if (merchantImage) {
//         merchantImageURL = await uploadToFirebase(
//           merchantImage[0],
//           "merchantImages"
//         );
//       }
//       if (pancardImage) {
//         pancardImageURL = await uploadToFirebase(
//           pancardImage[0],
//           "PancardImages"
//         );
//       }
//       if (GSTINImage) {
//         GSTINImageURL = await uploadToFirebase(GSTINImage[0], "GSTINImages");
//       }
//       if (FSSAIImage) {
//         FSSAIImageURL = await uploadToFirebase(FSSAIImage[0], "FSSAIImages");
//       }
//       if (aadharImage) {
//         aadharImageURL = await uploadToFirebase(aadharImage[0], "AadharImages");
//       }
//     }

//     const newMerchant = await Merchant.create({
//       merchantName,
//       merchantImageURL,
//       displayAddress,
//       description,
//       geofence,
//       location,
//       pricing,
//       pancardNumber,
//       GSTINNumber,
//       FSSAINumber,
//       aadharNumber,
//       deliveryOption,
//       deliveryTime,
//       servingArea,
//       pancardImageURL,
//       GSTINImageURL,
//       FSSAIImageURL,
//       aadharImageURL,
//       availability,
//     });

//     if (!newMerchant) {
//       return next(appError("Error in creating new merchant"));
//     }

//     res.status(200).json({
//       message: "Merchant created successfully",
//     });
//   } catch (err) {
//     next(appError(err.message));
//   }
// };

// const addMerchantDetailsController = async (req, res, next) => {
//   const {
//     merchantName,
//     sponsorshipStatus,
//     subscriptionPlan,
//     paymentId,
//     orderId,
//     paymentSignature,
//   } = req.body;

//   const errors = validationResult(req);

//   let formattedErrors = {};
//   if (!errors.isEmpty()) {
//     errors.array().forEach((error) => {
//       formattedErrors[error.path] = error.msg;
//     });
//     return res.status(500).json({ errors: formattedErrors });
//   }

//   try {
//     const merchantFound = await Merchant.findById(req.params.merchantId);

//     if (!merchantFound) {
//       return next(appError("merchant not found", 404));
//     }

//     let sponsorship = {};
//     if (sponsorshipStatus) {
//       const isPaymentValid = verifyRazorpayPayment({
//         order_id: orderId,
//         payment_id: paymentId,
//         razorpay_signature: paymentSignature,
//       });

//       if (!isPaymentValid) {
//         return res.status(400).json({ error: "Invalid payment signature" });
//       }

//       const { startDate, endDate } = calculateDateRange(subscriptionPlan);
//       sponsorship = {
//         sponsorshipStatus: true,
//         plan: subscriptionPlan,
//         startDate,
//         endDate,
//         paymentDetails: paymentId,
//       };
//     }

//     const newMerchant = await Merchant.findByIdandUpdate(
//       req.params.merchnatId,
//       {
//         merchantName,

//         sponsorship,
//       },
//       { new: true }
//     );

//     if (!newMerchant) {
//       return next(appError("Error in adding merchant details"));
//     }

//     res.status(200).json(newMerchant);
//   } catch (err) {
//     next(appError(err.message));
//   }
// };

// const editMerchantController = async (req, res, next) => {
//   const {
//     username,
//     email,
//     phoneNumber,
//     merchantName,
//     displayAddress,
//     description,
//     geofence,
//     location,
//     pricing,
//     pancardNumber,
//     GSTINNumber,
//     FSSAINumber,
//     aadharNumber,
//     deliveryOption,
//     deliveryTime,
//     servingArea,
//     availability,
//   } = req.body;

//   const errors = validationResult(req);

//   let formattedErrors = {};
//   if (!errors.isEmpty()) {
//     errors.array().forEach((error) => {
//       formattedErrors[error.path] = error.msg;
//     });
//     return res.status(500).json({ errors: formattedErrors });
//   }

//   try {
//     const merchantToUpdate = await MerchantDetails.findById(
//       req.params.merchantId
//     );

//     if (!merchantToUpdate) {
//       return next(appError("Merchant not found", 404));
//     }

//     let merchantImageURL = merchantToUpdate.merchantImageURL;
//     let pancardImageURL = merchantToUpdate.pancardImageURL;
//     let GSTINImageURL = merchantToUpdate.GSTINImageURL;
//     let FSSAIImageURL = merchantToUpdate.FSSAIImageURL;
//     let aadharImageURL = merchantToUpdate.aadharImageURL;

//     // Check for changes in images
//     if (req.files && req.files.merchantImage) {
//       // Delete old merchant image
//       await deleteFromFirebase(merchantToUpdate.merchantImageURL);
//     }
//     // Check for changes in images
//     if (req.files && req.files.pancardImage) {
//       // Delete old merchant image
//       await deleteFromFirebase(merchantToUpdate.pancardImageURL);
//     }
//     // Check for changes in images
//     if (req.files && req.files.GSTINImage) {
//       // Delete old merchant image
//       await deleteFromFirebase(merchantToUpdate.GSTINImageURL);
//     }
//     // Check for changes in images
//     if (req.files && req.files.FSSAIImage) {
//       // Delete old merchant image
//       await deleteFromFirebase(merchantToUpdate.FSSAIImageURL);
//     }
//     // Check for changes in images
//     if (req.files && req.files.aadharImage) {
//       // Delete old merchant image
//       await deleteFromFirebase(merchantToUpdate.aadharImageURL);
//     }

//     if (req?.files) {
//       const {
//         merchantImage,
//         pancardImage,
//         GSTINImage,
//         FSSAIImage,
//         aadharImage,
//       } = req?.files;

//       if (merchantImage) {
//         merchantImageURL = await uploadToFirebase(
//           merchantImage[0],
//           "merchantImages"
//         );
//       }
//       if (pancardImage) {
//         pancardImageURL = await uploadToFirebase(
//           pancardImage[0],
//           "PancardImages"
//         );
//       }
//       if (GSTINImage) {
//         GSTINImageURL = await uploadToFirebase(GSTINImage[0], "GSTINImages");
//       }
//       if (FSSAIImage) {
//         FSSAIImageURL = await uploadToFirebase(FSSAIImage[0], "FSSAIImages");
//       }
//       if (aadharImage) {
//         aadharImageURL = await uploadToFirebase(aadharImage[0], "AadharImages");
//       }
//     }

//     await MerchantDetails.findByIdAndUpdate(
//       req.params.merchantId,
//       {
//         merchantName,
//         merchantImageURL,
//         displayAddress,
//         description,
//         geofence,
//         location,
//         pricing,
//         pancardNumber,
//         GSTINNumber,
//         FSSAINumber,
//         aadharNumber,
//         deliveryOption,
//         deliveryTime,
//         servingArea,
//         pancardImageURL,
//         GSTINImageURL,
//         FSSAIImageURL,
//         aadharImageURL,
//         availability,
//         username,
//         email,
//         phoneNumber,
//       },
//       {
//         new: true,
//       }
//     );

//     res.status(200).json({
//       message: "Merchant updated successfully",
//     });
//   } catch (err) {
//     next(appError(err.message));
//   }
// };
