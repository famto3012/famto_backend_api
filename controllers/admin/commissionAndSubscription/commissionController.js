const { validationResult } = require("express-validator");

const Commission = require("../../../models/Commission");
const CommissionLogs = require("../../../models/CommissionLog");
const Merchant = require("../../../models/Merchant");

const appError = require("../../../utils/appError");

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
      commission.commissionType =
        commissionType !== undefined
          ? commissionType
          : commission.commissionType;
      commission.merchantId =
        merchantId !== undefined ? merchantId : commission.merchantId;
      commission.commissionValue =
        commissionValue !== undefined
          ? commissionValue
          : commission.commissionValue;

      await commission.save();

      res.status(200).json({
        message: "Commission updated successfully",
        data: commission,
      });
    } else {
      const savedCommission = new Commission({
        commissionType,
        merchantId,
        commissionValue,
      });

      await savedCommission.save();

      const merchantFound = await Merchant.findById(merchantId);
      merchantFound.merchantDetail.pricing.push({
        modelType: "Commission",
        modelId: savedCommission._id,
      });
      await merchantFound.save();

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
      return res.status(400).json({
        status: "fail",
        message: "Commission Log ID are required",
      });
    }

    const commissionLog = await CommissionLogs.findByIdAndUpdate(
      commissionLogId,
      { status: "Paid" },
      { new: true }
    );

    if (!commissionLog) {
      return res.status(404).json({
        status: "fail",
        message: "No commission log found with the given ID",
      });
    }

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
        commissionType: commissionFound.commissionType,
        commissionValue: commissionFound.commissionValue,
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
