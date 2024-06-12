const express = require("express");
const {
  addMerchantController,
} = require("../../controllers/merchant/merchantController");
const { body, check } = require("express-validator");

const merchantRoute = express.Router();

merchantRoute.post(
  "/add-merchant",
  [
    body("username").trim().notEmpty().withMessage("Username is required"),
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Enter a valid email"),
    body("phoneNumber")
      .trim()
      .notEmpty()
      .withMessage("Phone number is required")
      .isMobilePhone("any")
      .withMessage("Enter a valid phone number"),
    body("merchantName")
      .trim()
      .notEmpty()
      .withMessage("Merchant name is required"),
    check("merchantImage").custom((value, { req }) => {
      if (!req.file || !req.file.merchantImage) {
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
      if (!req.file || !req.file.pancardImage) {
        throw new Error("Pancard image is required");
      }
      return true;
    }),
    body("GSTINNumber")
      .trim()
      .notEmpty()
      .withMessage("GSTIN number is required"),
    check("GSTINImage").custom((value, { req }) => {
      if (!req.file || !req.file.GSTINImage) {
        throw new Error("GSTIN image is required");
      }
      return true;
    }),
    body("FSSAINumber")
      .trim()
      .notEmpty()
      .withMessage("FSSAI number is required"),
    check("FSSAIImage").custom((value, { req }) => {
      if (!req.file || !req.file.FSSAIImage) {
        throw new Error("FSSAI image is required");
      }
      return true;
    }),
    body("aadharNumber")
      .trim()
      .notEmpty()
      .withMessage("Aadhar number is required"),
    check("aadharImage").custom((value, { req }) => {
      if (!req.file || !req.file.aadharImage) {
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
  addMerchantController
);

merchantRoute.put(
  "/update-merchant/:merchantId",
  [
    body("username").trim().notEmpty().withMessage("Username is required"),
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Enter a valid email"),
    body("phoneNumber")
      .trim()
      .notEmpty()
      .withMessage("Phone number is required")
      .isMobilePhone("any")
      .withMessage("Enter a valid phone number"),
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
  addMerchantController
);

module.exports = merchantRoute;
