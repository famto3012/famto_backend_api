const express = require("express");
const {
  addMerchantDetailsController,
  getAllMerchantsController,
  registerMerchantController,
  approveRegistrationController,
  declineRegistrationController,
  getSingleMerchantController,
  updateMerchantDetailsController,
} = require("../../../controllers/admin/merchant/merchantController");
const { upload } = require("../../../utils/imageOperation");
const isAdmin = require("../../../middlewares/isAdmin");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const { body, check } = require("express-validator");

const merchantRoute = express.Router();

//Register merchant
merchantRoute.post("/register", registerMerchantController);

//-------------------------------
//For Admin
//-------------------------------

//Approve merchant registration
merchantRoute.post(
  "/approve-merchant",
  isAuthenticated,
  isAdmin,
  approveRegistrationController
);

//Decline merchant registration
merchantRoute.post(
  "/decline-merchant",
  isAuthenticated,
  isAdmin,
  declineRegistrationController
);

//Get all merchants
merchantRoute.get(
  "/all-merchants",
  isAuthenticated,
  isAdmin,
  getAllMerchantsController
);

//Get single merchant
merchantRoute.get(
  "/:merchantId",
  isAuthenticated,
  isAdmin,
  getSingleMerchantController
);

//Add / Update Merchant details
// merchantRoute.put(
//   "/update-merchant-details/:merchantId",
//   upload.fields([
//     { name: "merchantImage", maxCount: 1 },
//     { name: "pancardImage", maxCount: 1 },
//     { name: "GSTINImage", maxCount: 1 },
//     { name: "FSSAIImage", maxCount: 1 },
//     { name: "aadharImage", maxCount: 1 },
//   ]),
//   [
//     body("merchantName")
//       .trim()
//       .notEmpty()
//       .withMessage("Merchant name is required"),
//     check("merchantImage").custom((value, { req }) => {
//       if (
//         !req.body.merchantImageURL &&
//         (!req.files || !req.files.merchantImage)
//       ) {
//         throw new Error("Merchant image is required");
//       }
//       return true;
//     }),
//     body("displayAddress")
//       .trim()
//       .notEmpty()
//       .withMessage("Display address is required"),
//     body("description")
//       .trim()
//       .notEmpty()
//       .withMessage("Description is required"),
//     body("geofenceId").trim().notEmpty().withMessage("Geofence is required"),
//     body("location").trim().notEmpty().withMessage("Location is required"),
//     body("pricing").trim().notEmpty().withMessage("Pricing is required"),
//     body("pancardNumber")
//       .trim()
//       .notEmpty()
//       .withMessage("Pancard number is required"),
//     check("pancardImage").custom((value, { req }) => {
//       if (
//         !req.body.pancardImageURL &&
//         (!req.files || !req.files.pancardImage)
//       ) {
//         throw new Error("Pancard image is required");
//       }
//       return true;
//     }),
//     body("GSTINNumber")
//       .trim()
//       .notEmpty()
//       .withMessage("GSTIN number is required"),
//     check("GSTINImage").custom((value, { req }) => {
//       if (!req.body.GSTINImageURL && (!req.files || !req.files.GSTINImage)) {
//         throw new Error("GSTIN image is required");
//       }
//       return true;
//     }),
//     body("FSSAINumber")
//       .trim()
//       .notEmpty()
//       .withMessage("FSSAI number is required"),
//     check("FSSAIImage").custom((value, { req }) => {
//       if (!req.body.FSSAIImageURL && (!req.files || !req.files.FSSAIImage)) {
//         throw new Error("FSSAI image is required");
//       }
//       return true;
//     }),
//     body("aadharNumber")
//       .trim()
//       .notEmpty()
//       .withMessage("Aadhar number is required"),
//     check("aadharImage").custom((value, { req }) => {
//       if (!req.body.aadharImageURL && (!req.files || !req.files.aadharImage)) {
//         throw new Error("Aadhar image is required");
//       }
//       return true;
//     }),
//     body("deliveryOption")
//       .trim()
//       .notEmpty()
//       .withMessage("Delivery option is required"),
//     body("deliveryTime")
//       .trim()
//       .notEmpty()
//       .withMessage("Delivery time is required"),
//     body("servingArea")
//       .trim()
//       .notEmpty()
//       .withMessage("Serving area is required"),
//     body("availability.type")
//       .trim()
//       .notEmpty()
//       .withMessage("Availability type is required"),
//     body("availability.specificDays")
//       .optional()
//       .custom((value, { req }) => {
//         if (!value) return true;

//         const days = [
//           "sunday",
//           "monday",
//           "tuesday",
//           "wednesday",
//           "thursday",
//           "friday",
//           "saturday",
//         ];
//         days.forEach((day) => {
//           if (
//             value[day] &&
//             value[day].specificTime &&
//             (!value[day].startTime || !value[day].endTime)
//           ) {
//             throw new Error(
//               `${day} specific time requires both start and end time`
//             );
//           }
//         });
//         return true;
//       }),
//   ],
//   // isAuthenticated,
//   // isAdmin,
//   updateMerchantDetailsController
// );

const validateUpdateMerchant = [
  body("fullName").trim().notEmpty().withMessage("Full name is required"),
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email address"),
  body("phoneNumber").trim().notEmpty().withMessage("Phone number is required"),
  // .isMobilePhone(["en-IN"])
  // .withMessage("Invalid phone number format"),
  body("status").trim().notEmpty().withMessage("Status is required"),
  body("merchantDetail")
    .isObject()
    .withMessage("Merchant details must be an object"),
  check("merchantImage").custom((value, { req }) => {
    if (
      !req.body.merchantDetail.merchantImageURL &&
      (!req.files || !req.files.merchantImage)
    ) {
      throw new Error("Merchant image is required");
    }
    return true;
  }),
  check("pancardImage").custom((value, { req }) => {
    if (
      !req.body.merchantDetail.pancardImageURL &&
      (!req.files || !req.files.pancardImage)
    ) {
      throw new Error("Pancard image is required");
    }
    return true;
  }),
  check("GSTINImage").custom((value, { req }) => {
    if (
      !req.body.merchantDetail.GSTINImageURL &&
      (!req.files || !req.files.GSTINImage)
    ) {
      throw new Error("GSTIN image is required");
    }
    return true;
  }),
  check("FSSAIImage").custom((value, { req }) => {
    if (
      !req.body.merchantDetail.FSSAIImageURL &&
      (!req.files || !req.files.FSSAIImage)
    ) {
      throw new Error("FSSAI image is required");
    }
    return true;
  }),
  check("aadharImage").custom((value, { req }) => {
    if (
      !req.body.merchantDetail.aadharImageURL &&
      (!req.files || !req.files.aadharImage)
    ) {
      throw new Error("Aadhar image is required");
    }
    return true;
  }),
];

//Update Merchant detail
merchantRoute.put(
  "/update-merchant-details/:merchantId",
  upload.fields([
    { name: "merchantImage", maxCount: 1 },
    { name: "pancardImage", maxCount: 1 },
    { name: "GSTINImage", maxCount: 1 },
    { name: "FSSAIImage", maxCount: 1 },
    { name: "aadharImage", maxCount: 1 },
  ]),
  validateUpdateMerchant,
  updateMerchantDetailsController
);

module.exports = merchantRoute;
