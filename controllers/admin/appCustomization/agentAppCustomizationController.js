const Agent = require("../../../models/Agent");
const AgentAppCustomization = require("../../../models/AgentAppCustomization");
const appError = require("../../../utils/appError");

const {
  deleteFromFirebase,
  uploadToFirebase,
} = require("../../../utils/imageOperation");

const updateAgentsWorkTime = async (oldWorkTime, newWorkTime) => {
  const newWorkTimeIds = newWorkTime
    .filter((newTime) => newTime._id)
    .map((newTime) => newTime._id.toString());

  const deletedTimings = oldWorkTime.filter(
    (oldTime) => !newWorkTimeIds.includes(oldTime._id.toString())
  );

  if (deletedTimings.length > 0) {
    await Agent.updateMany(
      {
        "workStructure.workTimings._id": {
          $in: deletedTimings.map((t) => t._id),
        },
      },
      {
        $pull: {
          "workStructure.workTimings": {
            _id: { $in: deletedTimings.map((t) => t._id) },
          },
        },
      }
    );
  }
};

const createOrUpdateAgentCustomizationController = async (req, res, next) => {
  try {
    const workingTime = req.body.workingTime
      ? typeof req.body.workingTime === "string"
        ? JSON.parse(req.body.workingTime)
        : req.body.workingTime
      : [];

    const updateFields = {
      email: req.body.email || false,
      phoneNumber: req.body.phoneNumber || false,
      emailVerification: req.body.emailVerification || false,
      otpVerification: req.body.otpVerification || false,
      loginViaOtp: req.body.loginViaOtp || false,
      loginViaGoogle: req.body.loginViaGoogle || false,
      loginViaApple: req.body.loginViaApple || false,
      loginViaFacebook: req.body.loginViaFacebook || false,
      workingTime,
    };

    if (req.file) {
      const splashScreenUrl = await uploadToFirebase(
        req.file,
        "AgentAppSplashScreenImages"
      );
      updateFields.splashScreenUrl = splashScreenUrl;
    }

    const customization = await AgentAppCustomization.findOne();

    let oldWorkTime = [];
    if (customization) {
      if (customization?.workingTime?.length) {
        oldWorkTime = customization.workingTime;
      }

      if (customization.splashScreenUrl)
        await deleteFromFirebase(customization.splashScreenUrl);

      Object.assign(customization, updateFields);

      await Promise.all([
        customization.save(),
        updateAgentsWorkTime(oldWorkTime, workingTime),
      ]);

      res.status(200).json({
        success: "Agent App Customization updated successfully",
        data: customization,
      });
    } else {
      const newCustomization = new AgentAppCustomization(updateFields);
      await newCustomization.save();
      res.status(200).json({
        success: "Agent App Customization created successfully",
        data: newCustomization,
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
      return res.status(200).json({
        data: {},
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

const getAgentWorkTimings = async (req, res, next) => {
  try {
    const customization = await AgentAppCustomization.findOne()
      .select("workingTime")
      .lean();

    const formattedResponse = customization?.workingTime?.map((time) => ({
      id: time._id,
      startTime: time.startTime,
      endTime: time.endTime,
    }));

    res.status(200).json(formattedResponse);
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  createOrUpdateAgentCustomizationController,
  getAgentCustomizationController,
  getAgentWorkTimings,
};
