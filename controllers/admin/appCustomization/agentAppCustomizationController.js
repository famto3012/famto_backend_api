const AgentAppCustomization = require("../../../models/AgentAppCustomization");
const appError = require("../../../utils/appError");

const {
  deleteFromFirebase,
  uploadToFirebase,
} = require("../../../utils/imageOperation");

// const createOrUpdateAgentCustomizationController = async (req, res, next) => {
//   try {
//     const {
//       email,
//       phoneNumber,
//       emailVerification,
//       otpVerification,
//       loginViaOtp,
//       loginViaGoogle,
//       loginViaApple,
//       loginViaFacebook,
//       workingTime,
//     } = req.body;

//     const customization = await AgentAppCustomization.findOne();
// console.log("workingTime", workingTime)
//     if (customization) {
//       let splashScreenUrl = customization.splashScreenUrl;
//       if (req.file) {
//         await deleteFromFirebase(customization.splashScreenUrl);
//         splashScreenUrl = await uploadToFirebase(
//           req.file,
//           "AgentAppSplashScreenImages"
//         );
//       }

//       customization.email = email !== undefined ? email : customization.email;
//       customization.phoneNumber =
//         phoneNumber !== undefined ? phoneNumber : customization.phoneNumber;
//       customization.emailVerification =
//         emailVerification !== undefined
//           ? emailVerification
//           : customization.emailVerification;
//       customization.otpVerification =
//         otpVerification !== undefined
//           ? otpVerification
//           : customization.otpVerification;
//       customization.loginViaOtp =
//         loginViaOtp !== undefined ? loginViaOtp : customization.loginViaOtp;
//       customization.loginViaGoogle =
//         loginViaGoogle !== undefined
//           ? loginViaGoogle
//           : customization.loginViaGoogle;
//       customization.loginViaApple =
//         loginViaApple !== undefined
//           ? loginViaApple
//           : customization.loginViaApple;
//       customization.loginViaFacebook =
//         loginViaFacebook !== undefined
//           ? loginViaFacebook
//           : customization.loginViaFacebook;
//       customization.splashScreenUrl = splashScreenUrl;

//       await customization.save();

//       res.status(200).json({
//         success: "Agent App Customization updated successfully",
//         data: customization,
//       });
//     } else {
//       let splashScreenUrl = "";
//       if (req.file) {
//         splashScreenUrl = await uploadToFirebase(
//           req.file,
//           "AgentAppSplashScreenImages"
//         );
//       }

//       const newAgentAppCustomization = new AgentAppCustomization({
//         email,
//         phoneNumber,
//         emailVerification,
//         otpVerification,
//         loginViaOtp,
//         loginViaGoogle,
//         loginViaApple,
//         loginViaFacebook,
//         splashScreenUrl,
//       });

//       await newAgentAppCustomization.save();

//       res.status(201).json({
//         success: "Agent App Customization created successfully",
//         data: newAgentAppCustomization,
//       });
//     }
//   } catch (err) {
//     next(appError(err.message));
//   }
// };

const createOrUpdateAgentCustomizationController = async (req, res, next) => {
  try {
    const {
      email,
      phoneNumber,
      emailVerification,
      otpVerification,
      loginViaOtp,
      loginViaGoogle,
      loginViaApple,
      loginViaFacebook,
      workingTime,
    } = req.body;
    const customization = await AgentAppCustomization.findOne();

    if (customization) {
      let splashScreenUrl = customization.splashScreenUrl;
      if (req.file) {
        await deleteFromFirebase(customization.splashScreenUrl);
        splashScreenUrl = await uploadToFirebase(
          req.file,
          "AgentAppSplashScreenImages"
        );
      }

      // Update fields, including workingTime
      customization.email = email !== undefined ? email : customization.email;
      customization.phoneNumber =
        phoneNumber !== undefined ? phoneNumber : customization.phoneNumber;
      customization.emailVerification =
        emailVerification !== undefined
          ? emailVerification
          : customization.emailVerification;
      customization.otpVerification =
        otpVerification !== undefined
          ? otpVerification
          : customization.otpVerification;
      customization.loginViaOtp =
        loginViaOtp !== undefined ? loginViaOtp : customization.loginViaOtp;
      customization.loginViaGoogle =
        loginViaGoogle !== undefined
          ? loginViaGoogle
          : customization.loginViaGoogle;
      customization.loginViaApple =
        loginViaApple !== undefined
          ? loginViaApple
          : customization.loginViaApple;
      customization.loginViaFacebook =
        loginViaFacebook !== undefined
          ? loginViaFacebook
          : customization.loginViaFacebook;
      customization.splashScreenUrl = splashScreenUrl;

      // Update the workingTime array
      if (workingTime !== undefined) {
        customization.workingTime = workingTime;
      }

      await customization.save();

      res.status(200).json({
        success: "Agent App Customization updated successfully",
        data: customization,
      });
    } else {
      let splashScreenUrl = "";
      if (req.file) {
        splashScreenUrl = await uploadToFirebase(
          req.file,
          "AgentAppSplashScreenImages"
        );
      }

      // Create a new AgentAppCustomization document
      const newAgentAppCustomization = new AgentAppCustomization({
        email,
        phoneNumber,
        emailVerification,
        otpVerification,
        loginViaOtp,
        loginViaGoogle,
        loginViaApple,
        loginViaFacebook,
        splashScreenUrl,
        workingTime,
      });

      await newAgentAppCustomization.save();

      res.status(200).json({
        success: "Agent App Customization created successfully",
        data: newAgentAppCustomization,
      });
    }
  } catch (err) {
    next(appError(err.message));
  }
};

const getAgentCustomizationController = async (req, res, next) => {
  try {
    const customization = await AgentAppCustomization.findOne();

    if (!customization) {
      return res.status(404).json({
        error: "Agent App Customization not found",
      });
    }

    res.status(200).json({
      success: "Agent App Customization fetched successfully",
      data: customization,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  createOrUpdateAgentCustomizationController,
  getAgentCustomizationController,
};
