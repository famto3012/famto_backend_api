const { body, check } = require("express-validator");

const addAgentByAdminValidations = [
  body("fullName").trim().notEmpty().withMessage("Full name is required"),
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email address"),
  body("phoneNumber").trim().notEmpty().withMessage("Phone number is required"),
  body("licensePlate")
    .trim()
    .notEmpty()
    .withMessage("License plate is required"),
  body("model").trim().notEmpty().withMessage("Vehicle modal is required"),
  body("type").trim().notEmpty().withMessage("Vehicle type is required"),
  check("rcFrontImage").custom((value, { req }) => {
    if (!req.files || !req.files.rcFrontImage) {
      throw new Error("RC front image is required");
    }
    return true;
  }),
  check("rcBackImage").custom((value, { req }) => {
    if (!req.files || !req.files.rcBackImage) {
      throw new Error("RC back image is required");
    }
    return true;
  }),
  body("accountHolderName")
    .trim()
    .notEmpty()
    .withMessage("Account holder is required"),
  body("accountNumber")
    .trim()
    .notEmpty()
    .withMessage("Account number is required"),
  body("IFSCCode").trim().notEmpty().withMessage("IFSC code is required"),
  body("UPIId").trim().notEmpty().withMessage("UPI Id is required"),
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
      throw new Error("Aadhar front image is required");
    }
    return true;
  }),
  check("aadharBackImage").custom((value, { req }) => {
    if (!req.files || !req.files.aadharBackImage) {
      throw new Error("Aadhar back image is required");
    }
    return true;
  }),
  check("drivingLicenseFrontImage").custom((value, { req }) => {
    if (!req.files || !req.files.drivingLicenseFrontImage) {
      throw new Error("Driving license front image is required");
    }
    return true;
  }),
  check("drivingLicenseBackImage").custom((value, { req }) => {
    if (!req.files || !req.files.drivingLicenseBackImage) {
      throw new Error("Driving license back image is required");
    }
    return true;
  }),
  // body("managerId").optional().trim(),
  body("salaryStructureId")
    .trim()
    .notEmpty()
    .withMessage("Salary structure is required"),
  body("geofenceId").trim().notEmpty().withMessage("Geofence is required"),
  body("tag").trim().notEmpty().withMessage("Tag is required"),
  check("agentImage").custom((value, { req }) => {
    if (!req.files || !req.files.agentImage) {
      throw new Error("Agent image is required");
    }
    return true;
  }),
];

const editAgentByAdminValidations = [
  body("fullName").trim().notEmpty().withMessage("Full name is required"),
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email address"),
  body("phoneNumber").trim().notEmpty().withMessage("Phone number is required"),
  body("licensePlate")
    .trim()
    .notEmpty()
    .withMessage("License plate is required"),
  body("model").trim().notEmpty().withMessage("Vehicle modal is required"),
  body("type").trim().notEmpty().withMessage("Vehicle type is required"),
  check("rcFrontImage").custom((value, { req }) => {
    if (
      !req.body.vehicleDetail[0].rcFrontImageURL &&
      (!req.files || !req.files.rcFrontImage)
    ) {
      throw new Error("RC front image is required");
    }
    return true;
  }),
  check("rcBackImage").custom((value, { req }) => {
    if (
      !req.body.vehicleDetail[0].rcBackImageURL &&
      (!req.files || !req.files.rcBackImage)
    ) {
      throw new Error("RC back image is required");
    }
    return true;
  }),
  body("bankDetail.accountHolderName")
    .trim()
    .notEmpty()
    .withMessage("Account holder is required"),
  body("bankDetail.accountNumber")
    .trim()
    .notEmpty()
    .withMessage("Account number is required"),
  body("bankDetail.IFSCCode")
    .trim()
    .notEmpty()
    .withMessage("IFSC code is required"),
  body("bankDetail.UPIId").trim().notEmpty().withMessage("UPI Id is required"),
  body("governmentCertificateDetail.aadharNumber")
    .trim()
    .notEmpty()
    .withMessage("Aadhar number is required"),
  body("governmentCertificateDetail.drivingLicenseNumber")
    .trim()
    .notEmpty()
    .withMessage("Driving license number is required"),
  check("aadharFrontImage").custom((value, { req }) => {
    if (
      !req.body.governmentCertificateDetail?.aadharFrontImageURL &&
      (!req.files || !req.files.aadharFrontImage)
    ) {
      throw new Error("Aadhar front image is required");
    }
    return true;
  }),
  check("aadharBackImage").custom((value, { req }) => {
    if (
      !req.body.governmentCertificateDetail?.aadharBackImageURL &&
      (!req.files || !req.files.aadharBackImage)
    ) {
      throw new Error("Aadhar back image is required");
    }
    return true;
  }),
  check("drivingLicenseFrontImage").custom((value, { req }) => {
    if (
      !req.body.governmentCertificateDetail?.drivingLicenseFrontImageURL &&
      (!req.files || !req.files.drivingLicenseFrontImage)
    ) {
      throw new Error("Driving license front image is required");
    }
    return true;
  }),
  check("drivingLicenseBackImage").custom((value, { req }) => {
    if (
      !req.body.governmentCertificateDetail?.drivingLicenseBackImageURL &&
      (!req.files || !req.files.drivingLicenseBackImage)
    ) {
      throw new Error("Driving license back image is required");
    }
    return true;
  }),
  body("workStructure.managerId").optional().trim(),
  body("workStructure.salaryStructureId")
    .trim()
    .notEmpty()
    .withMessage("Salary structure is required"),
  body("workStructure.geofenceId")
    .trim()
    .notEmpty()
    .withMessage("Geofence is required"),
  body("workStructure.tag").trim().notEmpty().withMessage("Tag is required"),
  check("agentImage").custom((value, { req }) => {
    if (!req.body.agentImageURL && (!req.files || !req.files.agentImage)) {
      throw new Error("Agent image is required");
    }
    return true;
  }),
];

module.exports = { addAgentByAdminValidations, editAgentByAdminValidations };
