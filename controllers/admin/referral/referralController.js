const Referral = require("../../../models/Referral");
const ReferralCode = require("../../../models/ReferralCode");
const appError = require("../../../utils/appError");

const addOrUpdateReferralController = async (req, res, next) => {
  const {
    referralType,
    referrerDiscount,
    referrerMaxDiscountValue,
    referrerAppHeadingAndDescription,
    refereeDiscount,
    refereeMaxDiscountValue,
    minOrderAmount,
    refereeDescription,
    status,
    referralCodeOnCustomerSignUp,
  } = req.body;

  try {
    if (referralType === "Flat-discount") {
      let existingFlatDiscountReferral = await Referral.findOne({
        referralType: "Flat-discount",
      });

      if (existingFlatDiscountReferral) {
        existingFlatDiscountReferral.referrerDiscount = referrerDiscount;
        existingFlatDiscountReferral.referrerAppHeadingAndDescription =
          referrerAppHeadingAndDescription;
        existingFlatDiscountReferral.refereeDiscount = refereeDiscount;
        existingFlatDiscountReferral.minOrderAmount = minOrderAmount;
        existingFlatDiscountReferral.refereeDescription = refereeDescription;
        existingFlatDiscountReferral.status = status;
        existingFlatDiscountReferral.referralCodeOnCustomerSignUp =
          referralCodeOnCustomerSignUp;

        await existingFlatDiscountReferral.save();
        res.status(200).json({ message: "Flat-discount criteria updated" });
      } else {
        const newFlatDiscountRefetal = await Referral.create({
          referralType,
          referrerDiscount,
          referrerAppHeadingAndDescription,
          refereeDiscount,
          minOrderAmount,
          refereeDescription,
          status,
          referralCodeOnCustomerSignUp,
        });

        if (!newFlatDiscountRefetal) {
          return next(appError("Error in creating loyalty point"));
        }

        res.status(201).json({ message: "Flat-discount criteria created" });
      }
    } else {
      let existingPercentageDiscountRefetal = await Referral.findOne({
        referralType: "Percentage-discount",
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
        existingPercentageDiscountRefetal.referralCodeOnCustomerSignUp =
          referralCodeOnCustomerSignUp;

        await existingPercentageDiscountRefetal.save();
        res
          .status(200)
          .json({ message: "Percentage-discount criteria updated" });
      } else {
        const newPercentageDiscountRefetal = await Referral.create({
          referralType,
          referrerDiscount,
          referrerMaxDiscountValue,
          referrerAppHeadingAndDescription,
          refereeDiscount,
          refereeMaxDiscountValue,
          minOrderAmount,
          refereeDescription,
          status,
          referralCodeOnCustomerSignUp,
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

const updateReferralStatus = async (req, res, next) => {
  try {
    const { referralType } = req.query;

    const referral = await Referral.findOne({ referralType });

    if (!referral) return next(appError("Referral not found", 404));

    if (!referral.status) {
      await Referral.updateMany(
        { referralType: { $ne: referralType } },
        { $set: { status: false } }
      );
    }

    referral.status = !referral.status;
    await referral.save();

    res.status(200).json({
      message: "Referral status updated successfully",
      updatedReferral: referral,
    });
  } catch (err) {
    next(appError(err.message || "Internal server error", 500));
  }
};

const getReferralController = async (req, res, next) => {
  try {
    const { referralType } = req.query;

    let referralCriteria;

    if (
      referralType === "Flat-discount" ||
      referralType === "Percentage-discount"
    ) {
      referralCriteria = await Referral.findOne({ referralType });
    } else {
      return next(appError("Invalid referral type"));
    }

    if (!referralCriteria) {
      return next(appError(`No ${referralType} criteria found`));
    }

    res.status(200).json({
      message: `${referralType} criteria found`,
      data: referralCriteria,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getReferralDetailController = async (req, res, next) => {
  try {
    const referrals = await ReferralCode.find({});

    const formattedResponse = referrals?.map((referral) => ({
      customerId: referral.customerId,
      name: referral.name,
      email: referral.email,
      referralCode: referral.referralCode,
      numOfReferrals: referral.numOfReferrals,
    }));

    res.status(200).json(formattedResponse);
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  addOrUpdateReferralController,
  getReferralController,
  getReferralDetailController,
  updateReferralStatus,
};
