const mongoose = require("mongoose");

const Customer = require("../../models/Customer");
const PickAndCustomCart = require("../../models/PickAndCustomCart");
const PromoCode = require("../../models/PromoCode");
const Order = require("../../models/Order");
const TemporaryOrder = require("../../models/TemporaryOrder");

const appError = require("../../utils/appError");
const {
  getDistanceFromPickupToDelivery,
  getDeliveryAndSurgeCharge,
  calculateScheduledCartValue,
  calculatePromoCodeDiscount,
} = require("../../utils/customerAppHelpers");
const {
  uploadToFirebase,
  deleteFromFirebase,
} = require("../../utils/imageOperation");
const { formatDate, formatTime } = require("../../utils/formatters");

const {
  sendNotification,
  sendSocketData,
  findRolesToNotify,
} = require("../../socket/socket");
const CustomerAppCustomization = require("../../models/CustomerAppCustomization");
const Tax = require("../../models/Tax");

const addShopController = async (req, res, next) => {
  try {
    const { latitude, longitude, shopName, place, buyFromAnyWhere } = req.body;

    const customerId = req.userAuth;
    const customer = await Customer.findById(customerId);

    if (!customer) return next(appError("Customer not found", 404));

    let updatedCartDetail;
    let pickupLocation;
    let deliveryLocation;
    let distance;
    let duration;

    //? If buyFromAnyWhere is true, set pickupLocation to null
    if (buyFromAnyWhere) {
      pickupLocation = [];
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

    // Check if a cart with the same customerId and deliveryMode exists
    const cartFound = await PickAndCustomCart.findOne({
      customerId,
      "cartDetail.deliveryMode": "Custom Order",
    });

    if (cartFound) await PickAndCustomCart.findByIdAndDelete(cartFound._id);

    const cart = await PickAndCustomCart.create({
      customerId,
      cartDetail: updatedCartDetail,
    });

    res.status(200).json({
      message: "Shop detail added successfully in Custom order",
      data: {
        shopName: shopName || null,
        place: place || null,
        distance: parseFloat(distance) || null,
        duration: duration || null,
        items: cart?.items || [],
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
      data: {
        cartId: cart._id,
        customerId: cart.customerId,
        cartDetail: cart.cartDetail,
        items: cart.items?.map((item) => ({
          itemId: item.itemId,
          itemName: item.itemName,
          quantity: item.quantity,
          unit: item.unit,
          numOfUnits: item.numOfUnits,
          itemImage: item.itemImageURL,
        })),
      },
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getSingleItemController = async (req, res, next) => {
  try {
    const { itemId } = req.params;

    const cart = await PickAndCustomCart.findOne({ customerId: req.userAuth });

    if (!cart) return next(appError("Cart not found", 404));

    const item = cart.items?.find((item) => item.itemId.toString() === itemId);
    if (!item) return next(appError("Item not found", 404));

    const formattedResponse = {
      itemId: item.itemId,
      itemName: item.itemName,
      quantity: item.quantity,
      unit: item.unit,
      numOfUnits: item.numOfUnits,
      itemImage: item.itemImageURL,
    };

    res.status(200).json(formattedResponse);
  } catch (err) {
    next(appError(err.message));
  }
};

const editItemInCartController = async (req, res, next) => {
  try {
    const { itemName, quantity, unit, numOfUnits } = req.body;
    const { itemId } = req.params;
    const customerId = req.userAuth;

    const cart = await PickAndCustomCart.findOne({ customerId });

    if (!cart) return next(appError("Cart not found", 404));

    const itemIndex = cart.items.findIndex(
      (item) => item.itemId.toString() === itemId
    );

    if (itemIndex === -1) return next(appError("Item not found", 404));

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

    if (!cart) return next(appError("Cart not found", 404));

    const itemIndex = cart.items.findIndex(
      (item) => item.itemId.toString() === itemId
    );

    if (itemIndex === -1) return next(appError("Item not found", 404));

    let itemImageURL = cart.items[itemIndex].itemImageURL;

    if (itemImageURL) await deleteFromFirebase(itemImageURL);

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
      instructionInDelivery,
    } = req.body;

    const customerId = req.userAuth;

    const [customer, cartFound] = await Promise.all([
      Customer.findById(customerId),
      PickAndCustomCart.findOne({
        customerId,
        "cartDetail.deliveryMode": "Custom Order",
      }),
    ]);

    if (!customer) return next(appError("Customer not found", 404));
    if (!cartFound) return next(appError("Cart not found", 404));

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

    let distance = 0;
    let duration = 0;

    const havePickupLocation =
      cartFound?.cartDetail?.pickupLocation?.length === 2;

    if (havePickupLocation) {
      const pickupLocation = cartFound.cartDetail.pickupLocation;
      const deliveryLocation = deliveryCoordinates;

      const { distanceInKM, durationInMinutes } =
        await getDistanceFromPickupToDelivery(pickupLocation, deliveryLocation);

      distance = parseFloat(distanceInKM);
      duration = parseInt(durationInMinutes);
    }

    let voiceInstructionToAgentURL =
      cartFound?.cartDetail?.voiceInstructionToDeliveryAgent || "";

    if (req.file) {
      if (voiceInstructionToAgentURL) {
        await deleteFromFirebase(voiceInstructionToAgentURL);
      }

      voiceInstructionToAgentURL = await uploadToFirebase(
        req.file,
        "VoiceInstructions"
      );
    }

    let updatedCartDetail = {
      pickupLocation: cartFound?.cartDetail?.pickupLocation || [],
      pickupAddress: cartFound.cartDetail.pickupAddress,
      deliveryAddress: deliveryAddress._doc,
      deliveryLocation: deliveryCoordinates,
      deliveryMode: cartFound.cartDetail.deliveryMode,
      distance,
      duration,
      instructionInDelivery,
      voiceInstructionToDeliveryAgent: voiceInstructionToAgentURL,
      deliveryOption: "On-demand",
    };

    // cartFound.cartDetail = updatedCartDetail;

    let updatedDeliveryCharges = 0;
    let updatedSurgeCharges = 0;
    let taxFound;

    if (distance && distance > 0) {
      const { deliveryCharges, surgeCharges } = await getDeliveryAndSurgeCharge(
        cartFound.customerId,
        cartFound.cartDetail.deliveryMode,
        distance
      );

      updatedDeliveryCharges = deliveryCharges;
      updatedSurgeCharges = surgeCharges;

      const tax = await CustomerAppCustomization.findOne({}).select(
        "customOrderCustomization"
      );

      taxFound = await Tax.findById(tax.customOrderCustomization.taxId);
    }

    let taxAmount = 0;
    if (taxFound) {
      const calculatedTax = (updatedDeliveryCharges * taxFound.tax) / 100;
      taxAmount = parseFloat(calculatedTax.toFixed(2));
    }

    updatedBillDetail = {
      originalDeliveryCharge: Math.round(updatedDeliveryCharges) || 0,
      deliveryChargePerDay: null,
      discountedDeliveryCharge: null,
      discountedAmount: null,
      originalGrandTotal:
        Math.round(updatedDeliveryCharges + taxAmount + updatedSurgeCharges) ||
        0,
      discountedGrandTotal: null,
      itemTotal: null,
      addedTip: null,
      subTotal: null,
      vehicleType: null,
      taxAmount,
      surgePrice: Math.round(updatedSurgeCharges) || null,
    };

    // cartFound.billDetail = updatedBillDetail;

    await PickAndCustomCart.findByIdAndUpdate(
      cartFound._id,
      {
        cartDetail: updatedCartDetail,
        items: cartFound.items,
        billDetail: updatedBillDetail,
      },
      { new: true }
    );

    const formattedItems = cartFound.items.map((item) => ({
      itemId: item.itemId,
      itemName: item.itemName,
      quantity: item?.quantity ? `${item.quantity} ${item.unit}` : null,
      numOfUnits: item.numOfUnits,
      itemImage: item.itemImageURL,
    }));

    const billDetail = {
      deliveryChargePerDay: cartFound?.billDetail?.deliveryChargePerDay || null,
      originalDeliveryCharge: havePickupLocation
        ? cartFound?.billDetail?.originalDeliveryCharge
        : null,
      discountedDeliveryCharge: havePickupLocation
        ? cartFound?.billDetail?.discountedDeliveryCharge
        : null,
      discountedAmount: havePickupLocation
        ? cartFound?.billDetail?.discountedAmount
        : null,
      originalGrandTotal: havePickupLocation
        ? cartFound?.billDetail?.originalGrandTotal
        : null,
      discountedGrandTotal: havePickupLocation
        ? cartFound?.billDetail?.discountedGrandTotal
        : null,
      taxAmount: havePickupLocation ? cartFound?.billDetail?.taxAmount : null,
      itemTotal: cartFound?.billDetail?.itemTotal || null,
      addedTip: cartFound?.billDetail?.addedTip || null,
      subTotal: havePickupLocation ? cartFound?.billDetail?.subTotal : null,
      vehicleType: cartFound?.billDetail?.vehicleType || null,
      surgePrice: cartFound?.billDetail?.surgePrice || null,
    };

    const formattedResponse = {
      items: formattedItems,
      billDetail,
      buyFromAnyWhere: !havePickupLocation,
    };

    res.status(200).json({
      message: "Delivery address added successfully",
      data: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const addTipAndApplyPromoCodeInCustomOrderController = async (
  req,
  res,
  next
) => {
  try {
    const customerId = req.userAuth;
    const { addedTip, promoCode } = req.body;

    const [customerFound, cart] = await Promise.all([
      Customer.findById(customerId),
      PickAndCustomCart.findOne({
        customerId,
        "cartDetail.deliveryMode": "Custom Order",
      }),
    ]);

    if (!customerFound) return next(appError("Customer not found", 404));
    if (!cart) return next(appError("Cart not found", 404));

    // Ensure the original delivery charge exists
    const { originalGrandTotal = 0, originalDeliveryCharge = 0 } =
      cart.billDetail.originalGrandTotal;

    // Add the tip
    const tip = parseInt(addedTip) || 0;
    const originalGrandTotalWithTip = originalGrandTotal + tip;

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
        deliveryMode: "Custom Order",
      });

      if (!promoCodeFound) {
        return next(appError("Promo code not found or inactive", 404));
      }

      const totalDeliveryPrice =
        cart.cartDetail.deliveryOption === "Scheduled"
          ? calculateScheduledCartValue(cart, promoCodeFound)
          : originalDeliveryCharge;

      // Check if total cart price meets minimum order amount
      if (totalDeliveryPrice < promoCodeFound.minOrderAmount) {
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
      discountAmount = calculatePromoCodeDiscount(
        promoCodeFound,
        totalDeliveryPrice
      );

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

    const havePickupLocation = cart.cartDetail.pickupLocation.length === 2;

    const billDetail = {
      deliveryChargePerDay: cart.billDetail.deliveryChargePerDay || null,
      originalDeliveryCharge: havePickupLocation
        ? cart.billDetail.originalDeliveryCharge
        : null,
      discountedDeliveryCharge: havePickupLocation
        ? cart.billDetail.discountedDeliveryCharge
        : null,
      discountedAmount: havePickupLocation
        ? cart.billDetail.discountedAmount
        : null,
      originalGrandTotal: havePickupLocation
        ? cart.billDetail.originalGrandTotal
        : null,
      discountedGrandTotal: havePickupLocation
        ? cart.billDetail.discountedGrandTotal
        : null,
      taxAmount: havePickupLocation ? cart.billDetail.taxAmount : null,
      itemTotal: cart.billDetail.itemTotal || null,
      addedTip: cart.billDetail.addedTip || null,
      subTotal: havePickupLocation ? cart.billDetail.subTotal : null,
      vehicleType: cart.billDetail.vehicleType || null,
      surgePrice: cart.billDetail.surgePrice || null,
    };

    res.status(200).json({
      message: "Tip and promo code applied successfully",
      data: {
        cartId: cart._id,
        customerId: cart.customerId,
        cartDetail: cart.cartDetail,
        items: cart.items,
        billDetail,
      },
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const confirmCustomOrderController = async (req, res, next) => {
  try {
    const customerId = req.userAuth;

    const [customer, cart] = await Promise.all([
      Customer.findById(customerId),
      PickAndCustomCart.findOne({
        customerId,
        "cartDetail.deliveryMode": "Custom Order",
      }),
    ]);

    if (!customer) return next(appError("Customer not found", 404));
    if (!cart) return next(appError("Cart not found", 404));

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

    let customerTransaction = {
      madeOn: new Date(),
      transactionType: "Bill",
      transactionAmount: orderAmount,
      type: "Debit",
    };

    // Generate a unique order ID
    const orderId = new mongoose.Types.ObjectId();

    // Store order details temporarily in the database
    const tempOrder = await TemporaryOrder.create({
      orderId,
      customerId,
      items: cart.items,
      orderDetail: cart.cartDetail,
      billDetail: orderBill,
      totalAmount: orderAmount,
      status: "Pending",
      paymentMode: "Cash-on-delivery",
      paymentStatus: "Pending",
    });

    customer.transactionDetail.push(customerTransaction);
    customer.walletTransactionDetail.push(walletTransaction);

    await customer.save();

    if (!tempOrder) return next(appError("Error in creating temporary order"));

    // Clear the cart
    await PickAndCustomCart.deleteOne({ customerId });

    // Return countdown timer to client
    res.status(200).json({
      message: "Custom order will be created in 1 minute.",
      orderId,
      countdown: 60,
    });

    // After 60 seconds, create the order if it is not cancelled
    setTimeout(async () => {
      const storedOrderData = await TemporaryOrder.findOne({ orderId });

      if (storedOrderData) {
        const deliveryTime = new Date();
        deliveryTime.setHours(deliveryTime.getHours() + 1);

        const newOrder = await Order.create({
          customerId: storedOrderData.customerId,
          items: storedOrderData.items,
          orderDetail: { ...storedOrderData.orderDetail, deliveryTime },
          billDetail: storedOrderData.billDetail,
          totalAmount: storedOrderData.totalAmount,
          status: storedOrderData.status,
          paymentMode: storedOrderData.paymentMode,
          paymentStatus: storedOrderData.paymentStatus,
          "orderDetailStepper.created": {
            by: storedOrderData.orderDetail.deliveryAddress.fullName,
            userId: storedOrderData.customerId,
            date: new Date(),
          },
        });

        if (!newOrder) {
          return next(appError("Error in creating order"));
        }

        // Remove the temporary order data from the database
        await TemporaryOrder.deleteOne({ orderId });

        // //? Update order count in realtime for Home page
        // await updateOrderStatus(newOrder._id, "Pending");

        const eventName = "newOrderCreated";

        const { rolesToNotify, data } = await findRolesToNotify(eventName);

        // Send notifications to each role dynamically
        for (const role of rolesToNotify) {
          let roleId;

          if (role === "admin") {
            roleId = process.env.ADMIN_ID;
          } else if (role === "merchant") {
            roleId = newOrder?.merchantId;
          } else if (role === "driver") {
            roleId = newOrder?.agentId;
          } else if (role === "customer") {
            roleId = newOrder?.customerId;
          }

          if (roleId) {
            const notificationData = {
              fcm: {
                orderId: newOrder._id,
                customerId: newOrder.customerId,
              },
            };

            await sendNotification(
              roleId,
              eventName,
              notificationData,
              role.charAt(0).toUpperCase() + role.slice(1)
            );
          }
        }

        const socketData = {
          ...data,

          orderId: newOrder._id,
          orderDetail: newOrder.orderDetail,
          billDetail: newOrder.billDetail,
          orderDetailStepper: newOrder.orderDetailStepper.created,

          //? Data for displaying detail in all orders table
          _id: newOrder._id,
          orderStatus: newOrder.status,
          merchantName: "-",
          customerName:
            newOrder?.orderDetail?.deliveryAddress?.fullName ||
            newOrder?.customerId?.fullName ||
            "-",
          deliveryMode: newOrder?.orderDetail?.deliveryMode,
          orderDate: formatDate(newOrder.createdAt),
          orderTime: formatTime(newOrder.createdAt),
          deliveryDate: newOrder?.orderDetail?.deliveryTime
            ? formatDate(newOrder.orderDetail.deliveryTime)
            : "-",
          deliveryTime: newOrder?.orderDetail?.deliveryTime
            ? formatTime(newOrder.orderDetail.deliveryTime)
            : "-",
          paymentMethod: newOrder.paymentMode,
          deliveryOption: newOrder.orderDetail.deliveryOption,
          amount: newOrder.billDetail.grandTotal,
        };

        sendSocketData(newOrder.customerId, eventName, socketData);
        sendSocketData(process.env.ADMIN_ID, eventName, socketData);
      }
    }, 60000);
  } catch (err) {
    next(appError(err.message));
  }
};

const cancelCustomBeforeOrderCreationController = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const orderFound = await TemporaryOrder.findOne({ orderId });
    if (!orderFound) return next(appError("Order not found", 404));

    const customerFound = await Customer.findById(orderFound.customerId);
    if (!customerFound) return next(appError("Customer not found", 404));

    let updatedTransactionDetail = {
      transactionType: "Refund",
      madeOn: new Date(),
      type: "Credit",
    };

    if (orderFound) {
      if (orderFound.paymentMode === "Famto-cash") {
        const orderAmount = orderFound.billDetail.grandTotal;
        if (orderFound.orderDetail.deliveryOption === "On-demand") {
          customerFound.customerDetails.walletBalance += orderAmount;
          updatedTransactionDetail.transactionAmount = orderAmount;
        }

        customerFound.transactionDetail.push(updatedTransactionDetail);

        // Remove the temporary order data from the database and push transaction to customer transaction
        await Promise.all([
          TemporaryOrder.deleteOne({ orderId }),
          customerFound.save(),
        ]);

        res.status(200).json({
          message: "Order cancelled and amount refunded to wallet",
        });
        return;
      } else if (orderFound.paymentMode === "Cash-on-delivery") {
        // Remove the temporary order data from the database
        await TemporaryOrder.deleteOne({ orderId });

        res.status(200).json({ message: "Order cancelled" });
        return;
      }
    } else {
      res.status(400).json({
        message: "Order creation already processed or not found",
      });
    }
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
  addTipAndApplyPromoCodeInCustomOrderController,
  confirmCustomOrderController,
  cancelCustomBeforeOrderCreationController,
  getSingleItemController,
};
