const { validationResult } = require("express-validator");

const LoyaltyPoint = require("../../../models/LoyaltyPoint");

const appError = require("../../../utils/appError");

// Create / Update loyalty point criteria
const addLoyaltyPointController = async (req, res, next) => {
  const {
    earningCriteriaRupee,
    earningCriteriaPoint,
    minOrderAmountForEarning,
    maxEarningPointPerOrder,
    expiryDuration,
    redemptionCriteriaPoint,
    redemptionCriteriaRupee,
    minOrderAmountForRedemption,
    minLoyaltyPointForRedemption,
    maxRedemptionAmountPercentage,
  } = req.body;

  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    let newCriteria = await LoyaltyPoint.findOne({});
    if (newCriteria) {
      newCriteria.earningCriteriaRupee = earningCriteriaRupee;
      newCriteria.earningCriteriaPoint = earningCriteriaPoint;
      newCriteria.minOrderAmountForEarning = minOrderAmountForEarning;
      newCriteria.maxEarningPointPerOrder = maxEarningPointPerOrder;
      newCriteria.expiryDuration = expiryDuration;
      newCriteria.redemptionCriteriaPoint = redemptionCriteriaPoint;
      newCriteria.redemptionCriteriaRupee = redemptionCriteriaRupee;
      newCriteria.minOrderAmountForRedemption = minOrderAmountForRedemption;
      newCriteria.minLoyaltyPointForRedemption = minLoyaltyPointForRedemption;
      newCriteria.maxRedemptionAmountPercentage = maxRedemptionAmountPercentage;

      await newCriteria.save();
      res.status(201).json({ message: "Loyalty point criteria updated" });
    } else {
      const newLoyaltyPointCriteria = await LoyaltyPoint.create({
        earningCriteriaRupee,
        earningCriteriaPoint,
        minOrderAmountForEarning,
        maxEarningPointPerOrder,
        expiryDuration,
        redemptionCriteriaPoint,
        redemptionCriteriaRupee,
        minOrderAmountForRedemption,
        minLoyaltyPointForRedemption,
        maxRedemptionAmountPercentage,
      });

      if (!newLoyaltyPointCriteria) {
        return next(appError("Error in creating loyalty point"));
      }

      res.status(201).json({ message: "Loyalty point criteria created" });
    }
  } catch (err) {
    next(appError(err.message));
  }
};

// Get loyalty point criteria
const getLoyaltyPointController = async (req, res, next) => {
  try {
    const loyaltyPointCriteriaFound = await LoyaltyPoint.findOne({});

    const formattedResponse = {
      status: loyaltyPointCriteriaFound?.status || false,
      earningCriteriaRupee:
        loyaltyPointCriteriaFound?.earningCriteriaRupee || null,
      earningCriteriaPoint:
        loyaltyPointCriteriaFound?.earningCriteriaPoint || null,
      minOrderAmountForEarning:
        loyaltyPointCriteriaFound?.minOrderAmountForEarning || null,
      maxEarningPointPerOrder:
        loyaltyPointCriteriaFound?.maxEarningPointPerOrder || null,
      expiryDuration: loyaltyPointCriteriaFound?.expiryDuration || null,
      redemptionCriteriaPoint:
        loyaltyPointCriteriaFound?.redemptionCriteriaPoint || null,
      redemptionCriteriaRupee:
        loyaltyPointCriteriaFound?.redemptionCriteriaRupee || null,
      minOrderAmountForRedemption:
        loyaltyPointCriteriaFound?.minOrderAmountForRedemption || null,
      minLoyaltyPointForRedemption:
        loyaltyPointCriteriaFound?.minLoyaltyPointForRedemption || null,
      maxRedemptionAmountPercentage:
        loyaltyPointCriteriaFound?.maxRedemptionAmountPercentage || null,
    };

    res.status(200).json({
      message: "Loyalty point criteria",
      data: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Enable / Disable status
const updateStatusController = async (req, res, next) => {
  try {
    let existingCriteria = await LoyaltyPoint.findOne({});

    if (existingCriteria) {
      existingCriteria.status = !existingCriteria.status;

      await existingCriteria.save();

      return res.status(200).json({
        message: "Loyalty point criteria status updated successfully",
        data: existingCriteria.status,
      });
    }

    res.status(200).json({
      message: "Loyalty point criteria is not added",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  addLoyaltyPointController,
  getLoyaltyPointController,
  updateStatusController,
};
