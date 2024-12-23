const MerchantAppCustomization = require("../../../models/MerchantAppCustomization");
const appError = require("../../../utils/appError");

const {
  deleteFromFirebase,
  uploadToFirebase,
} = require("../../../utils/imageOperation");

const createOrUpdateMerchantCustomizationController = async (
  req,
  res,
  next
) => {
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

    const customization = await MerchantAppCustomization.findOne();

    if (customization) {
      let splashScreenUrl = customization.splashScreenUrl;
      if (req.file) {
        await deleteFromFirebase(customization.splashScreenUrl);
        splashScreenUrl = await uploadToFirebase(
          req.file,
          "MerchantAppSplashScreenImages"
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
        success: "Merchant App Customization updated successfully",
        data: customization,
      });
    } else {
      let splashScreenUrl = "";
      if (req.file) {
        splashScreenUrl = await uploadToFirebase(
          req.file,
          "MerchantAppSplashScreenImages"
        );
      }

      const newMerchantAppCustomization = new MerchantAppCustomization({
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

      await newMerchantAppCustomization.save();

      res.status(200).json({
        success: "Merchant App Customization created successfully",
        data: newMerchantAppCustomization,
      });
    }
  } catch (err) {
    next(appError(err.message));
  }
};

const getMerchantCustomizationController = async (req, res, next) => {
  try {
    const customization = await MerchantAppCustomization.findOne();

    if (!customization) {
      return res.status(404).json({
        error: "Merchant App Customization not found",
      });
    }

    res.status(200).json({
      success: "Merchant App Customization fetched successfully",
      data: customization,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  createOrUpdateMerchantCustomizationController,
  getMerchantCustomizationController,
};
