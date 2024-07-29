const { body, check } = require("express-validator");

const agentRegisterValidations = [
  body("fullName").trim().notEmpty().withMessage("Full name is required"),
  body("email").trim().isEmail().withMessage("Valid email is required"),
  body("phoneNumber").trim().notEmpty().withMessage("Phone number is required"),
  body("latitude").trim().notEmpty().withMessage("Latitude is required"),
  body("longitude").trim().notEmpty().withMessage("Longitude is required"),
  check("agentImage").custom((value, { req }) => {
    if (!req.file) {
      throw new Error("Agent image is required");
    }
    return true;
  }),
];

const agentLoginValidation = [
  body("phoneNumber").trim().notEmpty().withMessage("Phone number is required"),
];

const editAgentValidations = [
  body("fullName").trim().notEmpty().withMessage("Full name is required"),
  body("email").trim().isEmail().withMessage("Valid email is required"),
  // check("agentImage").custom((value, { req }) => {
  //   if (!req.body.agentImageURL && !req.file) {
  //     throw new Error("Agent image is required");
  //   }
  //   return true;
  // }),
];

const vehicleDetailValidations = [
  body("model").trim().notEmpty().withMessage("Vehicle model is required"),
  body("type").trim().notEmpty().withMessage("Vehicle type is required"),
  body("licensePlate")
    .trim()
    .notEmpty()
    .withMessage("License plate is required"),
  check("rcFrontImage").custom((value, { req }) => {
    if (!req.files || !req.files.rcFrontImage) {
      throw new Error("RC Front Image is required for each vehicle");
    }
    return true;
  }),
  check("rcBackImage").custom((value, { req }) => {
    if (!req.files || !req.files.rcBackImage) {
      throw new Error("RC Back Image is required for each vehicle");
    }
    return true;
  }),
];

const governmentCertificateValidation = [
  body("aadharNumber")
    .trim()
    .notEmpty()
    .withMessage("Aadhar number is required"),
  body("drivingLicenseNumber")
    .trim()
    .notEmpty()
    .withMessage("Driving license number is required"),
  check("aadharFrontImage").custom((value, { req }) => {
    if (!req.files || !req.files.aadharFrontImage) {
      throw new Error("Aadhar Front Image is required");
    }
    return true;
  }),
  check("aadharBackImage").custom((value, { req }) => {
    if (!req.files || !req.files.aadharBackImage) {
      throw new Error("Aadhar Back Image is required");
    }
    return true;
  }),
  check("drivingLicenseFrontImage").custom((value, { req }) => {
    if (!req.files || !req.files.drivingLicenseFrontImage) {
      throw new Error("Driving License Front Image is required");
    }
    return true;
  }),
  check("drivingLicenseBackImage").custom((value, { req }) => {
    if (!req.files || !req.files.drivingLicenseBackImage) {
      throw new Error("Driving License Back Image is required");
    }
    return true;
  }),
];

const bankDetailValidations = [
  body("accountHolderName")
    .trim()
    .notEmpty()
    .withMessage("Account holder name is required"),
  body("accountNumber")
    .trim()
    .notEmpty()
    .withMessage("Account number is required"),
  body("IFSCCode").trim().notEmpty().withMessage("IFSC Code is required"),
  body("UPIId").trim().notEmpty().withMessage("UPI Id is required"),
];

module.exports = {
  agentLoginValidation,
  agentRegisterValidations,
  editAgentValidations,
  vehicleDetailValidations,
  governmentCertificateValidation,
  bankDetailValidations,
};
