const CustomerAppCustomization = require("../../../models/CustomerAppCustomization");
const appError = require("../../../utils/appError");
const { formatTime } = require("../../../utils/formatters");

const {
  deleteFromFirebase,
  uploadToFirebase,
} = require("../../../utils/imageOperation");

const createOrUpdateCustomerCustomizationController = async (
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
    const customOrderTiming = JSON.parse(req.body.customOrderTiming);
    const pickAndDropTiming = JSON.parse(req.body.pickAndDropTiming);
    const customization = await CustomerAppCustomization.findOne();
    console.log("customOrderTiming", customOrderTiming)
    console.log("pickAndDropTiming", pickAndDropTiming)
    // Helper function to update fields only if provided
    const updateField = (field, newValue) =>
      newValue !== undefined ? newValue : field;

    if (customization) {
      // Handle file upload and deletion
      let splashScreenUrl = customization.splashScreenUrl;
      if (req.file) {
        await deleteFromFirebase(customization.splashScreenUrl);
        splashScreenUrl = await uploadToFirebase(
          req.file,
          "CustomerAppSplashScreenImages"
        );
      }

      // Update the customization fields using the helper function
      customization.email = updateField(customization.email, email);
      customization.phoneNumber = updateField(
        customization.phoneNumber,
        phoneNumber
      );
      customization.emailVerification = updateField(
        customization.emailVerification,
        emailVerification
      );
      customization.otpVerification = updateField(
        customization.otpVerification,
        otpVerification
      );
      customization.loginViaOtp = updateField(
        customization.loginViaOtp,
        loginViaOtp
      );
      customization.loginViaGoogle = updateField(
        customization.loginViaGoogle,
        loginViaGoogle
      );
      customization.loginViaApple = updateField(
        customization.loginViaApple,
        loginViaApple
      );
      customization.loginViaFacebook = updateField(
        customization.loginViaFacebook,
        loginViaFacebook
      );
      customization.splashScreenUrl = splashScreenUrl;
      customization.customOrderTiming = {
        startTime: customOrderTiming?.startTime,
        endTime: customOrderTiming?.endTime,
      };
      customization.pickAndDropTiming = {
        startTime: pickAndDropTiming?.startTime,
        endTime: pickAndDropTiming?.endTime,
      };

      // Save and respond
      await customization.save();

      return res.status(200).json({
        success: "Customer App Customization updated successfully",
        data: customization,
      });
    }

    // If customization doesn't exist, create a new one
    let splashScreenUrl = req.file
      ? await uploadToFirebase(req.file, "AgentAppSplashScreenImages")
      : "";

    const newCustomerAppCustomization = new CustomerAppCustomization({
      email,
      phoneNumber,
      emailVerification,
      otpVerification,
      loginViaOtp,
      loginViaGoogle,
      loginViaApple,
      loginViaFacebook,
      splashScreenUrl,
      customOrderTiming,
      pickAndDropTiming,
    });

    await newCustomerAppCustomization.save();

    return res.status(201).json({
      success: "Customer App Customization created successfully",
      data: newCustomerAppCustomization,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getCustomerCustomizationController = async (req, res, next) => {
  try {
    const customization = await CustomerAppCustomization.findOne();

    if (!customization) {
      return res.status(404).json({
        error: "Customer App Customization not found",
      });
    }

    res.status(200).json({
      success: "Customer App Customization fetched successfully",
      data: customization,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getTimingsOfOrdersController = async (req, res, next) => {
  try {
    const customization = await CustomerAppCustomization.findOne();

    const formattedResponse = {
      customerOrderTimings: {
        startTime: formatTime(customization.customOrderTiming.startTime),
        endTime: formatTime(customization.customOrderTiming.endTime),
      },
      pickAndDropTimings: {
        startTime: formatTime(customization.pickAndDropTiming.startTime),
        endTime: formatTime(customization.pickAndDropTiming.endTime),
      },
    };

    res.status(200).json(formattedResponse);
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  createOrUpdateCustomerCustomizationController,
  getCustomerCustomizationController,
  getTimingsOfOrdersController,
};
