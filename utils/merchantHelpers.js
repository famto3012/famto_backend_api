const mongoose = require("mongoose");

const Order = require("../models/Order");
const Product = require("../models/Product");
const Merchant = require("../models/Merchant");

const preparePayoutForMerchant = async () => {
  try {
    const allMerchants = await Merchant.find({ isApproved: "Approved" });

    let startTime = new Date();
    startTime.setDate(startTime.getDate() - 1);
    startTime.setHours(18, 30, 0, 0);
    // startTime.setHours(0, 0, 0, 0);

    let endTime = new Date();
    endTime.setHours(18, 29, 59, 999);
    // endTime.setHours(23, 59, 59, 999);

    for (const merchant of allMerchants) {
      const allOrders = await Order.find({
        merchantId: merchant._id,
        createdAt: {
          $gte: startTime,
          $lte: endTime,
        },
        status: "Completed",
      })
        .select("purchasedItems")
        .lean();

      let totalCostPrice = 0;
      let completedOrders = allOrders?.length;

      for (const order of allOrders) {
        // if (order.status === "Completed") completedOrders += 1;

        for (const item of order.purchasedItems) {
          const { productId, variantId, quantity } = item;

          if (variantId) {
            // Find all variants and map through them to locate the specific variantType by variantId
            const product = await Product.findById(productId).lean();
            if (product) {
              product.variants.forEach((variant) => {
                const variantType = variant.variantTypes.find((type) =>
                  type._id.equals(variantId)
                );

                if (variantType) {
                  totalCostPrice += variantType.costPrice * quantity;
                }
              });
            }
          } else if (productId) {
            // Find the cost price of the product if only productId is available
            const product = await Product.findById(productId).lean();
            if (product) {
              totalCostPrice += product.costPrice * quantity;
            }
          }
        }
      }

      const payoutData = {
        payoutId: new mongoose.Types.ObjectId(),
        totalCostPrice,
        completedOrders,
        date: startTime,
      };

      console.log("MerchantId: ", merchant._id);
      console.log("payoutData: ", payoutData);

      await Merchant.findByIdAndUpdate(
        merchant._id,
        { $push: { payoutDetail: payoutData } },
        { new: true, useFindAndModify: false }
      );
    }
  } catch (err) {
    console.error("Error in preparing payout:", err);
  }
};

module.exports = { preparePayoutForMerchant };
