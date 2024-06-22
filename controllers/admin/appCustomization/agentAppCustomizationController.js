const AgentAppCustomization = require("../../../models/AgentAppCustomization");
const {
  deleteFromFirebase,
  uploadToFirebase,
} = require("../../../utils/imageOperation");

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
      });

      await newAgentAppCustomization.save();

      res.status(201).json({
        success: "Agent App Customization created successfully",
        data: newAgentAppCustomization,
      });
    }
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = { createOrUpdateAgentCustomizationController };
