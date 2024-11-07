const { validationResult } = require("express-validator");

const Commission = require("../../../models/Commission");
const CommissionLogs = require("../../../models/CommissionLog");
const Merchant = require("../../../models/Merchant");

const appError = require("../../../utils/appError");
const ActivityLog = require("../../../models/ActivityLog");
const SubscriptionLog = require("../../../models/SubscriptionLog");

const addAndEditCommissionController = async (req, res, next) => {
  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const { commissionType, merchantId, commissionValue } = req.body;

    const commission = await Commission.findOne({ merchantId });

    if (commission) {
      commission.commissionType = commissionType ?? commission.commissionType;
      commission.merchantId = merchantId ?? commission.merchantId;
      commission.commissionValue =
        commissionValue ?? commission.commissionValue;

      await commission.save();

      await ActivityLog.create({
        userId: req.userAuth,
        userType: req.userRole,
        description: `Updated commission value of Merchant ${merchantId} by Admin (${req.userAuth})`,
      });

      res.status(200).json({
        message: "Commission updated successfully",
        data: commission,
      });
    } else {
      const merchantFound = await Merchant.findById(merchantId);

      if (!merchantFound) return next(appError("Merchant not found", 404));

      if (merchantFound.merchantDetail.pricing.length >= 1) {
        const lastData =
          merchantFound.merchantDetail.pricing[
            merchantFound.merchantDetail.pricing.length - 1
          ];

        const subscriptionLogFound = await SubscriptionLog.findById(
          lastData.modelId
        );

        if (subscriptionLogFound.endDate > new Date()) {
          return next(appError("Current subscription have not ended yet", 400));
        }
      }

      const savedCommission = new Commission({
        commissionType,
        merchantId,
        commissionValue,
      });

      await savedCommission.save();

      merchantFound.merchantDetail.pricing.push({
        modelType: "Commission",
        modelId: savedCommission._id,
      });

      await merchantFound.save();

      await ActivityLog.create({
        userId: req.userAuth,
        userType: req.userRole,
        description: `New commission updated for Merchant ${merchantId} by Admin ${req.userAuth}`,
      });

      res.status(200).json({
        message: "Commission added successfully",
        data: savedCommission,
      });
    }
  } catch (err) {
    next(appError(err.message));
  }
};

const getAllCommissionLogController = async (req, res, next) => {
  try {
    const commissionLogs = await CommissionLogs.find({});

    res.status(200).json({
      status: "success",
      data: {
        commissionLogs,
      },
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getCommissionLogsByMerchantName = async (req, res) => {
  try {
    const { merchantName } = req.query;

    if (!merchantName) {
      return res.status(400).json({
        status: "fail",
        message: "Merchant name is required",
      });
    }

    const commissionLogs = await CommissionLogs.find({
      merchantName: new RegExp(`^${merchantName}`, "i"),
    });

    res.status(200).json({
      status: "success",
      data: {
        commissionLogs,
      },
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getCommissionLogsByCreatedDate = async (req, res, next) => {
  try {
    const { date, merchantId } = req.query;

    if (!date) return next(appError("Date is missing", 400));

    let startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);

    let endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    let commissionLogs;

    if (merchantId) {
      commissionLogs = await CommissionLogs.find({
        merchantId,
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      });
    } else {
      commissionLogs = await CommissionLogs.find({
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      });
    }

    res.status(200).json({
      message: "Data fetched successfully",
      data: commissionLogs,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getCommissionLogsByMerchantId = async (req, res) => {
  try {
    const merchantId = req.params.merchantId;

    if (!merchantId) return next(appError("Merchant id is required", 400));

    const commissionLogs = await CommissionLogs.find({ merchantId });

    res.status(200).json({
      status: "success",
      data: {
        commissionLogs,
      },
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const updateCommissionLogStatus = async (req, res) => {
  try {
    const { commissionLogId } = req.params;

    if (!commissionLogId) {
      return next(appError("Commission Log ID are required", 400));
    }

    const commissionLog = await CommissionLogs.findById(commissionLogId);

    if (!commissionLog) {
      return next(appError("No commission log found", 404));
    }

    commissionLog.status = "Paid";

    await commissionLog.save();

    await ActivityLog.create({
      userId: req.userAuth,
      userType: req.userRole,
      description: `Updated commission payment status of ${commissionLog.merchantName} (${commissionLog.merchantId}) by Admin (${req.userAuth})`,
    });

    res.status(200).json({
      status: "success",
      data: {
        commissionLog,
      },
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getCommissionDetailOfMerchant = async (req, res, next) => {
  try {
    const merchantId = req.userAuth;

    const commissionFound = await Commission.findOne({ merchantId });

    res.status(200).json({
      message: "Commission of merchant",
      data: {
        commissionType: commissionFound?.commissionType || null,
        commissionValue: commissionFound?.commissionValue || null,
      },
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  addAndEditCommissionController,
  getAllCommissionLogController,
  getCommissionLogsByMerchantName,
  getCommissionLogsByCreatedDate,
  getCommissionLogsByMerchantId,
  updateCommissionLogStatus,
  getCommissionDetailOfMerchant,
};
