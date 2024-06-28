const { body, check } = require("express-validator");

// const merchantDetailValidations = [
//   body("fullName").trim().notEmpty().withMessage("Full name is required"),
//   body("email")
//     .trim()
//     .notEmpty()
//     .withMessage("Email is required")
//     .isEmail()
//     .withMessage("Invalid email address"),
//   body("phoneNumber").trim().notEmpty().withMessage("Phone number is required"),
//   body("merchantName")
//     .trim()
//     .notEmpty()
//     .withMessage("Merchant name is required"),
//   check("merchantImage").custom((value, { req }) => {
//     if (
//       !req.body.merchantImageURL &&
//       (!req.files || !req.files.merchantImage)
//     ) {
//       throw new Error("Merchant image is required");
//     }
//     return true;
//   }),
//   body("displayAddress")
//     .trim()
//     .notEmpty()
//     .withMessage("Display address is required"),
//   body("description")
//     .trim()
//     .notEmpty()
//     .withMessage("Description is required")
//     .isLength({ min: 3, max: 10 })
//     .withMessage("Description must be between 3 to 10 characters"),
//   body("geofenceId").trim().notEmpty().withMessage("Geofence is required"),
//   body("location").trim().notEmpty().withMessage("Location is required"),
//   body("pancardNumber")
//     .trim()
//     .notEmpty()
//     .withMessage("Pancard number is required"),
//   check("pancardImage").custom((value, { req }) => {
//     if (!req.body.pancardImageURL && (!req.files || !req.files.pancardImage)) {
//       throw new Error("Pancard image is required");
//     }
//     return true;
//   }),
//   body("GSTINNumber").trim().notEmpty().withMessage("GSTIN number is required"),
//   check("GSTINImage").custom((value, { req }) => {
//     if (!req.body.GSTINImageURL && (!req.files || !req.files.GSTINImage)) {
//       throw new Error("GSTIN image is required");
//     }
//     return true;
//   }),
//   body("FSSAINumber").trim().notEmpty().withMessage("FSSAI number is required"),
//   check("FSSAIImage").custom((value, { req }) => {
//     if (!req.body.FSSAIImageURL && (!req.files || !req.files.FSSAIImage)) {
//       throw new Error("FSSAI image is required");
//     }
//     return true;
//   }),
//   body("aadharNumber")
//     .trim()
//     .notEmpty()
//     .withMessage("Aadhar number is required"),
//   check("aadharImage").custom((value, { req }) => {
//     if (!req.body.aadharImageURL && (!req.files || !req.files.aadharImage)) {
//       throw new Error("Aadhar image is required");
//     }
//     return true;
//   }),
//   body("businessCategoryId")
//     .trim()
//     .notEmpty()
//     .withMessage("Business category is required"),
//   body("deliveryOption")
//     .trim()
//     .notEmpty()
//     .withMessage("Delivery option is required"),
//   body("deliveryTime")
//     .trim()
//     .notEmpty()
//     .withMessage("Delivery time is required")
//     .isNumeric()
//     .withMessage("Delivery time must be a number"),
//   body("servingArea").trim().notEmpty().withMessage("Serving area is required"),
//   body("availability.type")
//     .trim()
//     .notEmpty()
//     .withMessage("Availability type is required"),
//   body("availability.specificDays")
//     .optional()
//     .custom((value, { req }) => {
//       if (!value) return true;

//       const days = [
//         "sunday",
//         "monday",
//         "tuesday",
//         "wednesday",
//         "thursday",
//         "friday",
//         "saturday",
//       ];
//       days.forEach((day) => {
//         if (
//           value[day] &&
//           value[day].specificTime &&
//           (!value[day].startTime || !value[day].endTime)
//         ) {
//           throw new Error(
//             `${day} specific time requires both start and end time`
//           );
//         }
//       });
//       return true;
//     }),
// ];

const merchantDetailValidations = [
  body("fullName").trim().notEmpty().withMessage("Full name is required"),
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email address"),
  body("phoneNumber").trim().notEmpty().withMessage("Phone number is required"),
  body("merchantDetail.merchantName")
    .trim()
    .notEmpty()
    .withMessage("Merchant name is required"),
  check("merchantDetail.merchantImageURL").custom((value, { req }) => {
    if (!value && (!req.files || !req.files.merchantImage)) {
      throw new Error("Merchant image is required");
    }
    return true;
  }),
  body("merchantDetail.displayAddress")
    .trim()
    .notEmpty()
    .withMessage("Display address is required"),
  body("merchantDetail.description")
    .trim()
    .notEmpty()
    .withMessage("Description is required")
    .isLength({ min: 3, max: 10 })
    .withMessage("Description must be between 3 to 10 characters"),
  body("merchantDetail.geofenceId")
    .trim()
    .notEmpty()
    .withMessage("Geofence is required"),
  body("merchantDetail.location")
    .trim()
    .notEmpty()
    .withMessage("Location is required"),
  body("merchantDetail.pancardNumber")
    .trim()
    .notEmpty()
    .withMessage("Pancard number is required"),
  check("merchantDetail.pancardImageURL").custom((value, { req }) => {
    if (!value && (!req.files || !req.files.pancardImage)) {
      throw new Error("Pancard image is required");
    }
    return true;
  }),
  body("merchantDetail.GSTINNumber")
    .trim()
    .notEmpty()
    .withMessage("GSTIN number is required"),
  check("merchantDetail.GSTINImageURL").custom((value, { req }) => {
    if (!value && (!req.files || !req.files.GSTINImage)) {
      throw new Error("GSTIN image is required");
    }
    return true;
  }),
  body("merchantDetail.FSSAINumber")
    .trim()
    .notEmpty()
    .withMessage("FSSAI number is required"),
  check("merchantDetail.FSSAIImageURL").custom((value, { req }) => {
    if (!value && (!req.files || !req.files.FSSAIImage)) {
      throw new Error("FSSAI image is required");
    }
    return true;
  }),
  body("merchantDetail.aadharNumber")
    .trim()
    .notEmpty()
    .withMessage("Aadhar number is required"),
  check("merchantDetail.aadharImageURL").custom((value, { req }) => {
    if (!value && (!req.files || !req.files.aadharImage)) {
      throw new Error("Aadhar image is required");
    }
    return true;
  }),
  body("merchantDetail.businessCategoryId")
    .trim()
    .notEmpty()
    .withMessage("Business category is required"),
  body("merchantDetail.merchantFoodType").optional().trim(),
  body("merchantDetail.deliveryOption")
    .trim()
    .notEmpty()
    .withMessage("Delivery option is required"),
  body("merchantDetail.deliveryTime")
    .trim()
    .notEmpty()
    .withMessage("Delivery time is required")
    .isNumeric()
    .withMessage("Delivery time must be a number"),
  body("merchantDetail.servingArea")
    .trim()
    .notEmpty()
    .withMessage("Serving area is required"),
  body("merchantDetail.availability.type")
    .trim()
    .notEmpty()
    .withMessage("Availability type is required"),
  body("merchantDetail.availability.specificDays")
    .optional()
    .custom((value, { req }) => {
      if (!value) return true;

      const days = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];
      days.forEach((day) => {
        if (
          value[day] &&
          value[day].specificTime &&
          (!value[day].startTime || !value[day].endTime)
        ) {
          throw new Error(
            `${day} specific time requires both start and end time`
          );
        }
      });
      return true;
    }),
];

const merchantValidations = [
  body("fullName").trim().notEmpty().withMessage("Full name is required"),
  body("email")
    .trim()
    .notEmpty()
    .withMessage("email is required")
    .isEmail()
    .withMessage("Invalid email"),
  body("phoneNumber").trim().notEmpty().withMessage("Phone number is required"),
  body("password").trim().notEmpty().withMessage("Password is required"),
  body("confirmPassword")
    .trim()
    .notEmpty()
    .withMessage("Confirmation password is required")
    .custom((value, { req }) => {
      if (req.body.password !== value) {
        throw new Error("Passwords do not match");
      }

      return true;
    }),
];

module.exports = { merchantDetailValidations, merchantValidations };
