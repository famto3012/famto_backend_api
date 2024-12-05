const CustomerAppCustomization = require("../../../models/CustomerAppCustomization");
const appError = require("../../../utils/appError");

const {
  deleteFromFirebase,
  uploadToFirebase,
} = require("../../../utils/imageOperation");

const getCustomerCustomizationController = async (req, res, next) => {
  try {
    const customization = await CustomerAppCustomization.findOne({});

    const formattedResponse = {
      splashScreenUrl: customization?.splashScreenUrl || null,
      phoneNumber: customization?.phoneNumber || false,
      emailVerification: customization?.emailVerification || false,
      email: customization?.email || false,
      otpVerification: customization?.otpVerification || false,
      loginViaOtp: customization?.loginViaOtp || false,
      loginViaGoogle: customization?.loginViaGoogle || false,
      loginViaApple: customization?.loginViaApple || false,
      loginViaFacebook: customization?.loginViaFacebook || false,
      customOrderCustomization: {
        startTime: customization?.customOrderCustomization?.startTime || null,
        endTime: customization?.customOrderCustomization?.endTime || null,
        taxId: customization?.customOrderCustomization?.taxId || null,
      },
      pickAndDropOrderCustomization: {
        startTime:
          customization?.pickAndDropOrderCustomization?.startTime || null,
        endTime: customization?.pickAndDropOrderCustomization?.endTime || null,
        taxId: customization?.pickAndDropOrderCustomization?.taxId || null,
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

    const customization = await CustomerAppCustomization.findOne({});

    let splashScreenUrl = customization?.splashScreenUrl;

    if (req.file) {
      await deleteFromFirebase(customization.splashScreenUrl);
      splashScreenUrl = await uploadToFirebase(
        req.file,
        "CustomerAppSplashScreenImages"
      );
    }

    if (customization) {
      await CustomerAppCustomization.findOneAndUpdate({
        email,
        phoneNumber,
        emailVerification,
        otpVerification,
        loginViaOtp,
        loginViaGoogle,
        loginViaApple,
        loginViaFacebook,
        splashScreenUrl,
        customOrderCustomization: {
          startTime: customOrderCustomization.startTime,
          endTime: customOrderCustomization.endTime,
          taxId: customOrderCustomization.taxId,
        },
        pickAndDropOrderCustomization: {
          startTime: pickAndDropOrderCustomization.startTime,
          endTime: pickAndDropOrderCustomization.endTime,
          taxId: pickAndDropOrderCustomization.taxId,
        },
      });
    } else {
      await CustomerAppCustomization.create({
        email,
        phoneNumber,
        emailVerification,
        otpVerification,
        loginViaOtp,
        loginViaGoogle,
        loginViaApple,
        loginViaFacebook,
        splashScreenUrl,
        customOrderCustomization: {
          startTime: customOrderCustomization.startTime,
          endTime: customOrderCustomization.endTime,
          taxId: customOrderCustomization.taxId,
        },
        pickAndDropOrderCustomization: {
          startTime: pickAndDropOrderCustomization.startTime,
          endTime: pickAndDropOrderCustomization.endTime,
          taxId: pickAndDropOrderCustomization.taxId,
        },
      });
    }

    return res.status(200).json({
      message: "Customer App Customization updated successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  createOrUpdateCustomerCustomizationController,
  getCustomerCustomizationController,
  getTimingsForCustomerApp,
};
