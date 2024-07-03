const { validationResult } = require("express-validator");
const Commission = require("../../../models/Commission");
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

      res.status(200).json({
        message: "Commission added successfully",
        data: savedCommission,
      });
    }
  } catch (err) {
    next(appError(err.message));
  }
};



module.exports = { addAndEditCommissionController };
