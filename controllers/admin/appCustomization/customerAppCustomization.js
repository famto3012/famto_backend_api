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
      customOrderCustomization,
      pickAndDropOrderCustomization,
    } = req.body;

    const parsedCustomOrderCustomization = JSON.parse(customOrderCustomization);
    const parsedPickAndDropOrderCustomization = JSON.parse(
      pickAndDropOrderCustomization
    );

    const customization = await CustomerAppCustomization.findOne({});

    const updateField = (field, newValue) =>
      newValue !== undefined ? newValue : field;

    if (customization) {
      // Handle file upload and deletion
      let splashScreenUrl = customization?.splashScreenUrl;
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

      customization.customOrderCustomization = {
        startTime: parsedCustomOrderCustomization?.startTime,
        endTime: parsedCustomOrderCustomization?.endTime,
        taxId: parsedCustomOrderCustomization?.taxId,
      };
      customization.pickAndDropOrderCustomization = {
        startTime: parsedPickAndDropOrderCustomization?.startTime,
        endTime: parsedPickAndDropOrderCustomization?.endTime,
        taxId: parsedPickAndDropOrderCustomization?.taxId,
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
      customOrderCustomization,
      pickAndDropOrderCustomization,
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
    const customization = await CustomerAppCustomization.findOne({});

    if (!customization) return next(appError("Customization not found", 404));

    const formattedResponse = {
      splashScreenUrl: customization?.splashScreenUrl || null,
      phoneNumber: customization.phoneNumber || false,
      emailVerification: customization.emailVerification || false,
      email: customization.email || false,
      otpVerification: customization.otpVerification || false,
      loginViaOtp: customization.loginViaOtp || false,
      loginViaGoogle: customization.loginViaGoogle || false,
      loginViaApple: customization.loginViaApple || false,
      loginViaFacebook: customization.loginViaFacebook || false,
      customOrderCustomization: {
        startTime: customization.customOrderCustomization.startTime,
        endTime: customization.customOrderCustomization.endTime,
        taxId: customization.customOrderCustomization.taxId || null,
      },
      pickAndDropOrderCustomization: {
        startTime: customization.pickAndDropOrderCustomization.startTime,
        endTime: customization.pickAndDropOrderCustomization.endTime,
        taxId: customization.pickAndDropOrderCustomization.taxId || null,
      },
    };

    res.status(200).json(formattedResponse);
  } catch (err) {
    next(appError(err.message));
  }
};

const getTimingsForCustomerApp = async (req, res, next) => {
  try {
    const customization = await CustomerAppCustomization.findOne({}).select(
      "customOrderCustomization pickAndDropOrderCustomization"
    );

    const formattedResponse = {
      customOrderTimings: {
        startTime: customization.customOrderCustomization.startTime,
        endTime: customization.customOrderCustomization.endTime,
      },
      pickAndDropOrderTimings: {
        startTime: customization.pickAndDropOrderCustomization.startTime,
        endTime: customization.pickAndDropOrderCustomization.endTime,
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
  getTimingsForCustomerApp,
};
