const mongoose = require("mongoose");
const Customer = require("../../models/Customer");
const PickAndCustomCart = require("../../models/PickAndCustomCart");
const appError = require("../../utils/appError");
const {
  getDistanceFromPickupToDelivery,
  getDeliveryAndSurgeCharge,
} = require("../../utils/customerAppHelpers");
const {
  uploadToFirebase,
  deleteFromFirebase,
} = require("../../utils/imageOperation");
const PromoCode = require("../../models/PromoCode");
const Order = require("../../models/Order");
const LoyaltyPoint = require("../../models/LoyaltyPoint");

const addShopController = async (req, res, next) => {
  try {
    const { latitude, longitude, shopName, place, buyFromAnyWhere } = req.body;

    const customerId = req.userAuth;

    const customer = await Customer.findById(customerId);

    let cartFound;
    let updatedCartDetail;
    let pickupLocation;
    let deliveryLocation;
    let distance;
    let duration;

    if (buyFromAnyWhere) {
      pickupLocation = null;
      deliveryLocation = customer.customerDetails.location;

      distance = 0;
      duration = 0;

      updatedCartDetail = {
        pickupLocation,
        deliveryLocation,
        deliveryMode: "Custom Order",
        deliveryOption: "On-demand",
        distance,
        duration,
      };
    } else {
      pickupLocation = [latitude, longitude];
      deliveryLocation = customer.customerDetails.location;

      const { distanceInKM, durationInMinutes } =
        await getDistanceFromPickupToDelivery(pickupLocation, deliveryLocation);

      cartFound = await PickAndCustomCart.findOne({ customerId });

      distance = distanceInKM;
      duration = durationInMinutes;

      updatedCartDetail = {
        pickupLocation,
        pickupAddress: {
          fullName: shopName,
          area: place,
        },
        deliveryLocation,
        deliveryMode: "Custom Order",
        deliveryOption: "On-demand",
        distance,
        duration,
      };
    }

    if (cartFound) {
      await PickAndCustomCart.findByIdAndUpdate(
        cartFound._id,
        {
          cartDetail: updatedCartDetail,
        },
        { new: true }
      );
    } else {
      await PickAndCustomCart.create({
        customerId,
        cartDetail: updatedCartDetail,
      });
    }

    res.status(200).json({
      message: "Shop detail added successfully in Custom order",
      data: {
        shopName: shopName || null,
        place: place || null,
        distance: parseFloat(distance) || null,
        duaration: duration || null,
      },
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const addItemsToCartController = async (req, res, next) => {
  try {
    const { itemName, quantity, unit, numOfUnits } = req.body;

    const customerId = req.userAuth;

    const cart = await PickAndCustomCart.findOne({ customerId });

    if (!cart) {
      return next(appError("Cart not found", 404));
    }

    let itemImageURL;

    if (req.file) {
      itemImageURL = await uploadToFirebase(
        req.file,
        "Custom-order-item-Image"
      );
    }

    let updatedItems = {
      itemId: new mongoose.Types.ObjectId(),
      itemName,
      quantity,
      unit,
      numOfUnits,
      itemImageURL,
    };

    cart.items.push(updatedItems);

    await cart.save();

    res.status(200).json({
      message: "Item added successfully",
      data: cart,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const editItemInCartController = async (req, res, next) => {
  try {
    const { itemName, quantity, unit, numOfUnits } = req.body;
    const { itemId } = req.params;

    const customerId = req.userAuth;

    console.log("Customer ID:", customerId);

    const cart = await PickAndCustomCart.findOne({ customerId });

    if (!cart) {
      return next(appError("Cart not found", 404));
    }

    console.log("Cart items:", cart.items);

    const itemIndex = cart.items.findIndex(
      (item) => item.itemId.toString() === itemId
    );

    console.log("Item index:", itemIndex);

    if (itemIndex === -1) {
      return next(appError("Item not found", 404));
    }

    let itemImageURL = cart.items[itemIndex].itemImageURL;

    if (req.file) {
      // If there's a new image, delete the old one and upload the new image
      if (cart.items[itemIndex].itemImageURL) {
        await deleteFromFirebase(cart.items[itemIndex].itemImageURL);
      }

      itemImageURL = await uploadToFirebase(
        req.file,
        "Custom-order-item-Image"
      );
    }

    // Update the item details
    cart.items[itemIndex] = {
      itemId: cart.items[itemIndex].itemId,
      itemName,
      quantity,
      unit,
      numOfUnits,
      itemImageURL,
    };

    await cart.save();

    res.status(200).json({ message: "Item updated successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

const deleteItemInCartController = async (req, res, next) => {
  try {
    const { itemId } = req.params;

    const customerId = req.userAuth;

    const cart = await PickAndCustomCart.findOne({ customerId });

    if (!cart) {
      return next(appError("Cart not found", 404));
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.itemId.toString() === itemId
    );

    if (itemIndex === -1) {
      return next(appError("Item not found", 404));
    }

    let itemImageURL = cart.items[itemIndex].itemImageURL;

    if (itemImageURL) {
      // Delete the item image from Firebase
      await deleteFromFirebase(itemImageURL);
    }

    // Remove the item from the cart
    cart.items.splice(itemIndex, 1);

    // Save the updated cart
    await cart.save();

    res.status(200).json({ message: "Item deleted successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

const addDeliveryAddressController = async (req, res, next) => {
  try {
    const {
      deliveryAddressType,
      deliveryAddressOtherAddressId,
      newDeliveryAddress,
      addNewDeliveryToAddressBook,
    } = req.body;

    const customerId = req.userAuth;

    const customer = await Customer.findById(customerId);

    if (!customer) {
      return next(appError("Customer not found", 404));
    }

    const cartFound = await PickAndCustomCart.findOne({ customerId });

    // Retrieve the specified drop address coordinates from the customer data
    let deliveryCoordinates;
    let deliveryAddress = {};

    if (newDeliveryAddress) {
      deliveryAddress = {
        ...newDropAddress,
      };

      deliveryCoordinates = newDropAddress.coordinates;

      if (addNewDeliveryToAddressBook) {
        if (deliveryAddressType === "home") {
          customer.customerDetails.homeAddress = deliveryAddress;
        } else if (deliveryAddressType === "work") {
          customer.customerDetails.workAddress = deliveryAddress;
        } else if (deliveryAddressType === "other") {
          customer.customerDetails.otherAddress.push({
            id: new mongoose.Types.ObjectId(),
            ...deliveryAddress,
          });
        }

        await customer.save();
      }
    } else {
      if (deliveryAddressType === "home") {
        deliveryCoordinates = customer.customerDetails.homeAddress.coordinates;
        deliveryAddress = { ...customer.customerDetails.homeAddress };
      } else if (deliveryAddressType === "work") {
        deliveryCoordinates = customer.customerDetails.workAddress.coordinates;
        deliveryAddress = { ...customer.customerDetails.workAddress };
      } else {
        const otherAddress = customer.customerDetails.otherAddress.find(
          (addr) => addr.id.toString() === deliveryAddressOtherAddressId
        );
        if (otherAddress) {
          deliveryCoordinates = otherAddress.coordinates;
          deliveryAddress = { ...otherAddress };
        } else {
          return res.status(404).json({ error: "Address not found" });
        }
      }
    }

    let distance,
      duration = 0;
    if (cartFound.cartDetail.pickupLocation) {
      const pickupLocation = cartFound.cartDetail.pickupLocation;
      const deliveryLocation = deliveryCoordinates;

      const { distanceInKM, durationInMinutes } =
        await getDistanceFromPickupToDelivery(pickupLocation, deliveryLocation);

      distance = parseFloat(distanceInKM);
      duration = parseInt(durationInMinutes);
    }

    let updatedCartDetail = {
      pickupLocation: cartFound.cartDetail.pickupLocation,
      pickupAddress: cartFound.cartDetail.pickupAddress,
      deliveryAddress: deliveryAddress._doc,
      deliveryLocation: deliveryCoordinates,
      deliveryMode: cartFound.cartDetail.deliveryMode,
      distance,
      duration,
      deliveryOption: "On-demand",
    };

    cartFound.cartDetail = updatedCartDetail;

    const { deliveryCharges, surgeCharges } = await getDeliveryAndSurgeCharge(
      cartFound.customerId,
      cartFound.cartDetail.deliveryMode,
      distance
    );

    updatedBillDetail = {
      originalDeliveryCharge: Math.round(deliveryCharges) || 0,
      deliveryChargePerDay: null,
      discountedDeliveryCharge: null,
      discountedAmount: null,
      originalGrandTotal: Math.round(deliveryCharges) || 0,
      discountedGrandTotal: null,
      itemTotal: null,
      addedTip: null,
      subTotal: null,
      vehicleType: null,
      surgePrice: Math.round(surgeCharges) || null,
    };

    cartFound.billDetail = updatedBillDetail;

    await cartFound.save();

    const formattedItems = cartFound.items.map((item) => ({
      itemName: item.itemName,
      quantity: `${item.quantity}${item.unit}`,
      numOfUnits: item.numOfUnits,
      itemImage: item.itemImageURL,
    }));

    const formattedResponse = {
      items: formattedItems,
      billDetail: cartFound.billDetail,
    };

    res.status(200).json({
      message: "Delivery address added successfully",
      data: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const addTipAndApplyPromocodeInCustomOrderController = async (
  req,
  res,
  next
) => {
  try {
    const customerId = req.userAuth;
    const { addedTip, promoCode } = req.body;

    // Ensure customer is authenticated
    if (!customerId) {
      return next(appError("Customer is not authenticated", 401));
    }

    const customerFound = await Customer.findById(customerId);
    if (!customerFound) {
      return next(appError("Customer not found", 404));
    }

    // Find the customer's cart
    const cart = await PickAndCustomCart.findOne({ customerId });
    if (!cart) {
      return next(appError("Cart not found", 404));
    }

    // Ensure the original delivery charge exists
    const originalDeliveryCharge =
      parseFloat(cart.billDetail.originalDeliveryCharge) || 0;

    // Add the tip
    const tip = parseInt(addedTip) || 0;
    const originalGrandTotalWithTip = originalDeliveryCharge + tip;

    cart.billDetail.addedTip = tip;
    cart.billDetail.originalGrandTotal = originalGrandTotalWithTip;

    let discountAmount = 0;

    // Apply the promo code if provided
    if (promoCode) {
      const promoCodeFound = await PromoCode.findOne({
        promoCode,
        geofenceId: customerFound.customerDetails.geofenceId,
        appliedOn: "Delivery-charge",
        status: true,
      });

      if (!promoCodeFound) {
        return next(appError("Promo code not found or inactive", 404));
      }

      // Check if total cart price meets minimum order amount
      if (originalGrandTotalWithTip < promoCodeFound.minOrderAmount) {
        return next(
          appError(
            `Minimum order amount is ${promoCodeFound.minOrderAmount}`,
            400
          )
        );
      }

      // Check promo code validity dates
      const now = new Date();
      if (now < promoCodeFound.fromDate || now > promoCodeFound.toDate) {
        return next(appError("Promo code is not valid at this time", 400));
      }

      // Check user limit for promo code
      if (promoCodeFound.noOfUserUsed >= promoCodeFound.maxAllowedUsers) {
        return next(appError("Promo code usage limit reached", 400));
      }

      // Calculate discount amount
      if (promoCodeFound.promoType === "Flat-discount") {
        discountAmount = promoCodeFound.discount;
      } else if (promoCodeFound.promoType === "Percentage-discount") {
        discountAmount =
          (originalGrandTotalWithTip * promoCodeFound.discount) / 100;
        if (discountAmount > promoCodeFound.maxDiscountValue) {
          discountAmount = promoCodeFound.maxDiscountValue;
        }
      }

      promoCodeFound.noOfUserUsed += 1;
      await promoCodeFound.save();
    }

    // Ensure proper type conversion for discountAmount
    discountAmount = parseFloat(discountAmount) || 0;

    const discountedDeliveryCharge = originalDeliveryCharge - discountAmount;
    const discountedGrandTotal = originalGrandTotalWithTip - discountAmount;

    cart.billDetail.discountedDeliveryCharge =
      discountedDeliveryCharge < 0 ? 0 : Math.round(discountedDeliveryCharge);
    cart.billDetail.discountedGrandTotal = Math.round(discountedGrandTotal);
    cart.billDetail.discountedAmount = discountAmount.toFixed(2);

    await cart.save();

    res.status(200).json({
      message: "Tip and promo code applied successfully",
      data: cart,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const confirmCustomOrderController = async (req, res, next) => {
  try {
    const customerId = req.userAuth;

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return next(appError("Customer not found", 404));
    }

    const cart = await PickAndCustomCart.findOne({ customerId });
    if (!cart) {
      return next(appError("Cart not found", 404));
    }

    const orderAmount =
      cart.billDetail.discountedGrandTotal ||
      cart.billDetail.originalGrandTotal;

    let orderBill = {
      deliveryChargePerDay: cart.billDetail.deliveryChargePerDay,
      deliveryCharge:
        cart.billDetail.discountedDeliveryCharge ||
        cart.billDetail.originalDeliveryCharge,
      taxAmount: cart.billDetail.taxAmount,
      discountedAmount: cart.billDetail.discountedAmount,
      grandTotal:
        cart.billDetail.discountedGrandTotal ||
        cart.billDetail.originalGrandTotal,
      itemTotal: cart.billDetail.itemTotal,
      addedTip: cart.billDetail.addedTip,
      subTotal: cart.billDetail.subTotal,
    };

    let walletTransaction = {
      closingBalance: customer?.customerDetails?.walletBalance,
      transactionAmount: orderAmount,
      date: new Date(),
      type: "Debit",
    };

    let customerTransation = {
      madeOn: new Date(),
      transactionType: "Bill",
      transactionAmount: orderAmount,
      type: "Debit",
    };

    // const loyaltyPointCriteria = await LoyaltyPoint.findOne({ status: true });

    // // let loyaltyPoint = 0;
    // const loyaltyPointEarnedToday =
    //   customer.customerDetails?.loyaltyPointEarnedToday || 0;

    // if (loyaltyPointCriteria) {
    //   if (orderAmount >= loyaltyPointCriteria.minOrderAmountForEarning) {
    //     if (loyaltyPointEarnedToday < loyaltyPointCriteria.maxEarningPoint) {
    //       const calculatedLoyaltyPoint = Math.min(
    //         orderAmount * loyaltyPointCriteria.earningCriteriaPoint,
    //         loyaltyPointCriteria.maxEarningPoint - loyaltyPointEarnedToday
    //       );
    //       customer.customerDetails.loyaltyPointEarnedToday =
    //         customer.customerDetails.loyaltyPointEarnedToday +
    //         Number(calculatedLoyaltyPoint);
    //       customer.customerDetails.totalLoyaltyPointEarned =
    //         customer.customerDetails.totalLoyaltyPointEarned +
    //         Number(calculatedLoyaltyPoint);
    //     }
    //   }
    // }

    const newOrder = await Order.create({
      customerId,
      items: cart.items,
      orderDetail: cart.cartDetail,
      billDetail: orderBill,
      totalAmount: orderAmount,
      status: "Pending",
      paymentMode: "Cash-on-delivery",
      paymentStatus: "Pending",
    });

    customer.transactionDetail.push(customerTransation);
    customer.walletTransactionDetail.push(walletTransaction);
    await customer.save();

    // Clear the cart
    await PickAndCustomCart.deleteOne({ customerId });

    const orderResponse = {
      _id: newOrder._id,
      customerId: newOrder.customerId,
      customerName:
        customer.fullName || newOrder.orderDetail.pickupAddress.fullName,
      status: newOrder.status,
      totalAmount: newOrder.totalAmount,
      paymentMode: newOrder.paymentMode,
      paymentStatus: newOrder.paymentStatus,
      items: newOrder.items,
      deliveryAddress: newOrder.orderDetail.deliveryAddress,
      billDetail: newOrder.billDetail,
      orderDetail: {
        pickupLocation: newOrder.orderDetail.pickupLocation,
        pickupAddress: newOrder.orderDetail.pickupAddress,
        deliveryLocation: newOrder.orderDetail.deliveryLocation,
        deliveryAddress: newOrder.orderDetail.deliveryAddress,
        deliveryMode: newOrder.orderDetail.deliveryMode,
        deliveryOption: newOrder.orderDetail.deliveryOption,
        distance: newOrder.orderDetail.distance,
      },
      createdAt: newOrder.createdAt,
      updatedAt: newOrder.updatedAt,
    };

    res.status(200).json({
      message: "Custom order created successfully",
      data: orderResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  addShopController,
  addItemsToCartController,
  editItemInCartController,
  deleteItemInCartController,
  addDeliveryAddressController,
  addTipAndApplyPromocodeInCustomOrderController,
  confirmCustomOrderController,
};
