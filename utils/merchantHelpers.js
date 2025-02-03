const mongoose = require("mongoose");

const Order = require("../models/Order");
const Product = require("../models/Product");
const Merchant = require("../models/Merchant");

const preparePayoutForMerchant = async () => {
  try {
    // console.log("Starting payout preparation...");

    const allMerchants = await Merchant.find({ isApproved: "Approved" }).lean();
    // console.log(`Found ${allMerchants.length} approved merchants.`);

    let startTime = new Date();
    let endTime = new Date();

    if (process.env.NODE_ENV === "production") {
      startTime.setUTCDate(startTime.getUTCDate() - 1);
      startTime.setUTCHours(18, 30, 0, 0);
      endTime.setUTCHours(18, 29, 59, 999);
      // console.log(
      //   `Production mode: Payout range set to ${startTime} - ${endTime}`
      // );
    } else {
      startTime.setDate(startTime.getDate() - 1);
      startTime.setUTCHours(0, 0, 0, 0);
      endTime.setUTCHours(23, 59, 59, 999);
      // console.log(
      //   `Development mode: Payout range set to ${startTime} - ${endTime}`
      // );
    }

    // Fetch all orders in bulk for the date range and approved merchants
    const allOrders = await Order.find({
      createdAt: {
        $gte: startTime,
        $lte: endTime,
      },
      status: "Completed",
    })
      .select("merchantId purchasedItems")
      .lean();
    // console.log(`Found ${allOrders.length} completed orders within the range.`);

    // Create a map to aggregate data by merchantId
    const merchantPayouts = new Map();

    // Fetch all products in bulk to avoid querying each product individually
    const productIds = allOrders.flatMap((order) =>
      order.purchasedItems.map((item) => item.productId)
    );
    // console.log(`Fetching products for ${productIds.length} product IDs.`);
    const products = await Product.find({ _id: { $in: productIds } }).lean();
    const productMap = new Map(
      products.map((product) => [product._id.toString(), product])
    );
    // console.log(`Fetched ${products.length} products.`);

    // Aggregate data for each order and calculate total cost price
    for (const order of allOrders) {
      const merchantId = order.merchantId.toString();
      const { purchasedItems } = order;
      let totalCostPrice = 0;

      for (const item of purchasedItems) {
        const { productId, variantId, quantity } = item;
        const product = productMap.get(productId.toString());

        if (product) {
          if (variantId) {
            const variant = product.variants.find((v) =>
              v.variantTypes.some((type) => type._id.equals(variantId))
            );

            if (variant) {
              const variantType = variant.variantTypes.find((type) =>
                type._id.equals(variantId)
              );
              if (variantType) {
                totalCostPrice += variantType.costPrice * quantity;
              }
            }
          } else {
            totalCostPrice += product.costPrice * quantity;
          }
        }
      }

      // Update the payout map for this merchant
      if (!merchantPayouts.has(merchantId)) {
        merchantPayouts.set(merchantId, {
          totalCostPrice: 0,
          completedOrders: 0,
        });
      }

      const payout = merchantPayouts.get(merchantId);
      payout.totalCostPrice += totalCostPrice;
      payout.completedOrders += 1;
    }

    // console.log(
    //   "Aggregated total cost and completed orders for all merchants."
    // );

    // Prepare bulk updates for merchants
    const bulkOperations = allMerchants.map((merchant) => {
      const payoutData = {
        payoutId: new mongoose.Types.ObjectId(),
        totalCostPrice:
          merchantPayouts.get(merchant._id.toString())?.totalCostPrice || 0,
        completedOrders:
          merchantPayouts.get(merchant._id.toString())?.completedOrders || 0,
        date: startTime,
      };

      return {
        updateOne: {
          filter: { _id: merchant._id },
          update: { $push: { payoutDetail: payoutData } },
        },
      };
    });

    // console.log(`Preparing ${bulkOperations.length} bulk update operations.`);

    // Execute all bulk operations at once
    if (bulkOperations.length > 0) {
      await Merchant.bulkWrite(bulkOperations);
    }
  } catch (err) {
    console.error("Error in preparing payout:", err);
  }
};

const resetStatusManualToggleForAllMerchants = async () => {
  try {
    const result = await Merchant.updateMany(
      { statusManualToggle: true }, // Match merchants with statusManualToggle set to true
      { $set: { statusManualToggle: false } } // Update the statusManualToggle to false
    );

    console.log(
      `Successfully updated ${result.modifiedCount} merchants to set statusManualToggle to false.`
    );

    return result;
  } catch (error) {
    console.error(
      "Error while updating statusManualToggle for merchants:",
      error
    );
    // throw error; // Propagate the error to handle it further if needed
  }
};

module.exports = {
  preparePayoutForMerchant,
  resetStatusManualToggleForAllMerchants,
};
