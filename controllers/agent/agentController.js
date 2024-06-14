const { validationResult } = require("express-validator");
const appError = require("../../utils/appError");
const Agent = require("../../models/Agent");
const { uploadToFirebase } = require("../../utils/imageOperation");

const registerAgentController = async (req, res, next) => {
  const { fullName, email, phoneNumber, location } = req.body;

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
    const emailFound = await Agent.findOne({ email: normalizedEmail });

    if (emailFound) {
      formattedErrors.email = "Email already exists";
      return res.status(409).json({ errors: formattedErrors });
    }

    let agentImageURL = "";

    if (req.file) {
      agentImageURL = await uploadToFirebase(req.file, "AgentImages");
    }

    const newAgent = await Agent.create({
      fullName,
      email,
      phoneNumber,
      location,
    });

    if (!newAgent) {
      return next(appError("Error in registering new agent"));
    }

    res.status(200).json({ message: "Agent registering successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

// const registerAgentControllerz = async (req, res, next) => {
//   const {
//     fullName,
//     email,
//     phoneNumber,
//     location,
//     governmentCertificateDetail,
//     vehicleDetail,
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
//     const normalizedEmail = email.toLowerCase();
//     const emailFound = await Agent.findOne({ email: normalizedEmail });

//     if (emailFound) {
//       formattedErrors.email = "Email already exists";
//       return res.status(409).json({ errors: formattedErrors });
//     }

//     let agentImageURL = "";
//     let aadharFrontImageURL = "";
//     let aadharBackImageURL = "";
//     let drivingLicenseFrontImageURL = "";
//     let drivingLicenseBackImageURL = "";

//     if (req.files) {
//       const {
//         agentImage,
//         aadharFrontImage,
//         aadharBackImage,
//         drivingLicenseFrontImage,
//         drivingLicenseBackImage,
//       } = req.files;

//       if (agentImage) {
//         agentImageURL = await uploadToFirebase(agentImage[0], "AgentImages");
//       }
//       if (aadharFrontImage) {
//         aadharFrontImageURL = await uploadToFirebase(
//           aadharFrontImage[0],
//           "AadharImages"
//         );
//       }
//       if (aadharBackImage) {
//         aadharBackImageURL = await uploadToFirebase(
//           aadharBackImage[0],
//           "AgentImages"
//         );
//       }
//       if (drivingLicenseFrontImage) {
//         drivingLicenseFrontImageURL = await uploadToFirebase(
//           drivingLicenseFrontImage[0],
//           "DrivingLisenceImages"
//         );
//       }
//       if (drivingLicenseBackImage) {
//         drivingLicenseBackImageURL = await uploadToFirebase(
//           drivingLicenseBackImage[0],
//           "DrivingLisenceImages"
//         );
//       }
//     }

//     const newAgent = await Agent.create({
//       fullName,
//       email,
//       phoneNumber,
//       location,
//       vehicleDetail,
//       governmentCertificateDetail,
//     });

//     if (!newAgent) {
//       return next(appError("Error in creating new agent"));
//     }

//     res.status(200).json({ message: "Agent created successfully" });
//   } catch (err) {
//     next(appError(err.message));
//   }
// };

module.exports = { registerAgentController };
