const express = require("express");
const {
  addMerchantController,
  editMerchantController,
} = require("../../controllers/merchant/merchantController");
const { upload } = require("../../utils/imageOperation");
const isAdmin = require("../../middlewares/isAdmin");
const isAuthenticated = require("../../middlewares/isAuthenticated");
const { body, check } = require("express-validator");

const merchantRoute = express.Router();

//TODO: Need to add authentication middlewaress
merchantRoute.post(
  "/add-merchant",
  upload.fields([
    { name: "merchantImage", maxCount: 1 },
    { name: "pancardImage", maxCount: 1 },
    { name: "GSTINImage", maxCount: 1 },
    { name: "FSSAIImage", maxCount: 1 },
    { name: "aadharImage", maxCount: 1 },
  ]),
  [
    body("merchantId").trim().notEmpty().withMessage("Merchant is required"),
    body("merchantName")
      .trim()
      .notEmpty()
      .withMessage("Merchant name is required"),
    check("merchantImage").custom((value, { req }) => {
      if (!req.files || !req.files.merchantImage) {
        throw new Error("Merchant image is required");
      }
      return true;
    }),
    body("displayAddress")
      .trim()
      .notEmpty()
      .withMessage("Display address is required"),
    body("description")
      .trim()
      .notEmpty()
      .withMessage("Description is required"),
    body("geofence").trim().notEmpty().withMessage("Geofence is required"),
    body("location").trim().notEmpty().withMessage("Location is required"),
    body("pricing").trim().notEmpty().withMessage("Pricing is required"),
    body("pancardNumber")
      .trim()
      .notEmpty()
      .withMessage("Pancard number is required"),
    check("pancardImage").custom((value, { req }) => {
      if (!req.files || !req.files.pancardImage) {
        throw new Error("Pancard image is required");
      }
      return true;
    }),
    body("GSTINNumber")
      .trim()
      .notEmpty()
      .withMessage("GSTIN number is required"),
    check("GSTINImage").custom((value, { req }) => {
      if (!req.files || !req.files.GSTINImage) {
        throw new Error("GSTIN image is required");
      }
      return true;
    }),
    body("FSSAINumber")
      .trim()
      .notEmpty()
      .withMessage("FSSAI number is required"),
    check("FSSAIImage").custom((value, { req }) => {
      if (!req.files || !req.files.FSSAIImage) {
        throw new Error("FSSAI image is required");
      }
      return true;
    }),
    body("aadharNumber")
      .trim()
      .notEmpty()
      .withMessage("Aadhar number is required"),
    check("aadharImage").custom((value, { req }) => {
      if (!req.files || !req.files.aadharImage) {
        throw new Error("Aadhar image is required");
      }
      return true;
    }),
    body("deliveryOption")
      .trim()
      .notEmpty()
      .withMessage("Delivery option is required"),
    body("deliveryTime")
      .trim()
      .notEmpty()
      .withMessage("Delivery time is required"),
    body("servingArea")
      .trim()
      .notEmpty()
      .withMessage("Serving area is required"),
    body("availability.type")
      .trim()
      .notEmpty()
      .withMessage("Availability type is required"),
    body("availability.specificDays")
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
  ],
  // isAuthenticated,
  // isAdmin,
  addMerchantController
);

//TODO: Need to add authentication middlewaress
merchantRoute.put(
  "/edit-merchant/:merchantId",
  upload.fields([
    { name: "merchantImage", maxCount: 1 },
    { name: "pancardImage", maxCount: 1 },
    { name: "GSTINImage", maxCount: 1 },
    { name: "FSSAIImage", maxCount: 1 },
    { name: "aadharImage", maxCount: 1 },
  ]),
  [
    body("merchantName")
      .trim()
      .notEmpty()
      .withMessage("Merchant name is required"),
    check("merchantImage").custom((value, { req }) => {
      if (
        !req.body.merchantImageURL &&
        (!req.file || !req.file.merchantImage)
      ) {
        throw new Error("Merchant image is required");
      }
      return true;
    }),
    body("displayAddress")
      .trim()
      .notEmpty()
      .withMessage("Display address is required"),
    body("description")
      .trim()
      .notEmpty()
      .withMessage("Description is required"),
    body("geofence").trim().notEmpty().withMessage("Geofence is required"),
    body("location").trim().notEmpty().withMessage("Location is required"),
    body("pricing").trim().notEmpty().withMessage("Pricing is required"),
    body("pancardNumber")
      .trim()
      .notEmpty()
      .withMessage("Pancard number is required"),
    check("pancardImage").custom((value, { req }) => {
      if (!req.body.pancardImageURL && (!req.file || !req.file.pancardImage)) {
        throw new Error("Pancard image is required");
      }
      return true;
    }),
    body("GSTINNumber")
      .trim()
      .notEmpty()
      .withMessage("GSTIN number is required"),
    check("GSTINImage").custom((value, { req }) => {
      if (!req.body.GSTINImageURL && (!req.file || !req.file.GSTINImage)) {
        throw new Error("GSTIN image is required");
      }
      return true;
    }),
    body("FSSAINumber")
      .trim()
      .notEmpty()
      .withMessage("FSSAI number is required"),
    check("FSSAIImage").custom((value, { req }) => {
      if (!req.body.FSSAIImageURL && (!req.file || !req.file.FSSAIImage)) {
        throw new Error("FSSAI image is required");
      }
      return true;
    }),
    body("aadharNumber")
      .trim()
      .notEmpty()
      .withMessage("Aadhar number is required"),
    check("aadharImage").custom((value, { req }) => {
      if (!req.body.aadharImageIRL && (!req.file || !req.file.aadharImage)) {
        throw new Error("Aadhar image is required");
      }
      return true;
    }),
    body("deliveryOption")
      .trim()
      .notEmpty()
      .withMessage("Delivery option is required"),
    body("deliveryTime")
      .trim()
      .notEmpty()
      .withMessage("Delivery time is required"),
    body("servingArea")
      .trim()
      .notEmpty()
      .withMessage("Serving area is required"),
    body("availability.type")
      .trim()
      .notEmpty()
      .withMessage("Availability type is required"),
    body("availability.specificDays")
      .optional() // Marking as optional since specificDays might not be present in the request
      .custom((value, { req }) => {
        if (!value) return true; // Return true if specificDays is not present
        // Validate specific days only if specificDays is present
        const days = [
          "sunday",
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
        ];
        for (const day of days) {
          if (!value.hasOwnProperty(day)) {
            throw new Error(`Specific day ${day} is missing`);
          }
        }
        return true;
      }),
  ],

  // isAuthenticated,
  // isAdmin,
  editMerchantController
);

module.exports = merchantRoute;
