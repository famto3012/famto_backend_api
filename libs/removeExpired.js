const MerchantDiscount = require("../models/MerchantDiscount");
const Product = require("../models/Product");
const ProductDiscount = require("../models/ProductDiscount");
const PromoCode = require("../models/PromoCode");

const removeExpiredMerchantDiscounts = async () => {
  try {
    const currentDate = new Date();
    await MerchantDiscount.deleteMany({ validTo: { $lt: currentDate } });
  } catch (err) {
    console.log(`Error in deleting expired merchant discounts`);
  }
};

const removeExpiredProductDiscount = async () => {
  try {
    const currentDate = new Date();

    const expiredDiscounts = await ProductDiscount.find({
      validTo: { $lt: currentDate },
    }).select("_id");

    if (!expiredDiscounts.length) return;

    const expiredDiscountIds = expiredDiscounts.map((discount) => discount._id);

    await Promise.all([
      ProductDiscount.deleteMany({ _id: { $in: expiredDiscountIds } }),
      Product.updateMany(
        { discountId: { $in: expiredDiscountIds } },
        { $set: { discountId: null } }
      ),
    ]);
  } catch (err) {
    console.error("Error in deleting expired product discounts:", err);
  }
};

const removeExpiredPromoCode = async () => {
  try {
    const currentDate = new Date();
    await PromoCode.deleteMany({ toDate: { $lt: currentDate } });
  } catch (err) {
    console.log(`Error while deleting expired promo codes`);
  }
};

module.exports = {
  removeExpiredMerchantDiscounts,
  removeExpiredProductDiscount,
  removeExpiredPromoCode,
};
