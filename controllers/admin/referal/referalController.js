const Referal = require("../../../models/Referal");
const appError = require("../../../utils/appError");

const addOrUpdateReferalController = async (req, res, next) => {
  const {
    referalType,
    referrerDiscount,
    referrerMaxDiscountValue,
    referrerAppHeadingAndDescription,
    refereeDiscount,
    refereeMaxDiscountValue,
    minOrderAmount,
    refereeDescription,
    status,
    referalCodeOnCustomerSignUp,
  } = req.body;

  try {
    if (referalType === "Flat-discount") {
      let existingFlatDiscountReferal = await Referal.findOne({
        referalType: "Flat-discount",
      });

      if (existingFlatDiscountReferal) {
        existingFlatDiscountReferal.referrerDiscount = referrerDiscount;
        existingFlatDiscountReferal.referrerAppHeadingAndDescription =
          referrerAppHeadingAndDescription;
        existingFlatDiscountReferal.refereeDiscount = refereeDiscount;
        existingFlatDiscountReferal.minOrderAmount = minOrderAmount;
        existingFlatDiscountReferal.refereeDescription = refereeDescription;
        existingFlatDiscountReferal.status = status;
        existingFlatDiscountReferal.referalCodeOnCustomerSignUp =
          referalCodeOnCustomerSignUp;

        await existingFlatDiscountReferal.save();
        res.status(200).json({ message: "Flat-discount criteria updated" });
      } else {
        const newFlatDiscountRefetal = await Referal.create({
          referalType,
          referrerDiscount,
          referrerAppHeadingAndDescription,
          refereeDiscount,
          minOrderAmount,
          refereeDescription,
          status,
          referalCodeOnCustomerSignUp,
        });

        if (!newFlatDiscountRefetal) {
          return next(appError("Error in creating loyalty point"));
        }

        res.status(201).json({ message: "Flat-discount criteria created" });
      }
    } else {
      let existingPercentageDiscountRefetal = await Referal.findOne({
        referalType: "Percentage-discount",
      });

      if (existingPercentageDiscountRefetal) {
        existingPercentageDiscountRefetal.referrerDiscount = referrerDiscount;
        existingPercentageDiscountRefetal.referrerMaxDiscountValue =
          referrerMaxDiscountValue;
        existingPercentageDiscountRefetal.referrerAppHeadingAndDescription =
          referrerAppHeadingAndDescription;
        existingPercentageDiscountRefetal.refereeDiscount = refereeDiscount;
        existingPercentageDiscountRefetal.refereeMaxDiscountValue =
          refereeMaxDiscountValue;
        existingPercentageDiscountRefetal.minOrderAmount = minOrderAmount;
        existingPercentageDiscountRefetal.refereeDescription =
          refereeDescription;
        existingPercentageDiscountRefetal.status = status;
        existingPercentageDiscountRefetal.referalCodeOnCustomerSignUp =
          referalCodeOnCustomerSignUp;

        await existingPercentageDiscountRefetal.save();
        res
          .status(200)
          .json({ message: "Percentage-discount criteria updated" });
      } else {
        const newPercentageDiscountRefetal = await Referal.create({
          referalType,
          referrerDiscount,
          referrerMaxDiscountValue,
          referrerAppHeadingAndDescription,
          refereeDiscount,
          refereeMaxDiscountValue,
          minOrderAmount,
          refereeDescription,
          status,
          referalCodeOnCustomerSignUp,
        });

        if (!newPercentageDiscountRefetal) {
          return next(appError("Error in creating loyalty point"));
        }

        res
          .status(201)
          .json({ message: "Percentage-discount criteria created" });
      }
    }
  } catch (err) {
    next(appError(err.message));
  }
};

const getReferalController = async (req, res, next) => {
  try {
    const { referalType } = req.query;

    let referalCriteria;

    if (
      referalType === "Flat-discount" ||
      referalType === "Percentage-discount"
    ) {
      referalCriteria = await Referal.findOne({ referalType });
    } else {
      return next(appError("Invalid referal type"));
    }

    if (!referalCriteria) {
      return next(appError(`No ${referalType} criteria found`));
    }

    res.status(200).json({
      message: `${referalType} criteria found`,
      data: referalCriteria,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = { addOrUpdateReferalController, getReferalController };
