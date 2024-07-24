const appError = require("../../utils/appError");
const Customer = require("../../models/Customer");
const {
  getDistanceFromPickupToDelivery,
  calculateDeliveryCharges,
} = require("../../utils/customerAppHelpers");
const mongoose = require("mongoose");
const CustomerPricing = require("../../models/CustomerPricing");
const PromoCode = require("../../models/PromoCode");
const {
  createRazorpayOrderId,
  verifyPayment,
} = require("../../utils/razorpayPayment");
const Order = require("../../models/Order");
const Agent = require("../../models/Agent");
const {
  convertToUTC,
  convertStartDateToUTC,
  convertEndDateToUTC,
} = require("../../utils/formatters");
const PickAndCustomCart = require("../../models/PickAndCustomCart");
const ScheduledPickAndCustom = require("../../models/ScheduledPickAndCustom");
const CustomerSurge = require("../../models/CustomerSurge");

const addPickUpAddressController = async (req, res, next) => {
  try {
    const {
      pickupAddressType,
      pickupAddressOtherAddressId,
      newPickupAddress,
      addNewPickupToAddressBook,
      instructionInPickup,
      deliveryAddressType,
      deliveryAddressOtherAddressId,
      newDropAddress,
      addNewDeliveryToAddressBook,
      instructionInDelivery,
      startDate,
      endDate,
      time,
    } = req.body;

    const customerId = req.userAuth;

    const customer = await Customer.findById(customerId);

    if (!customer) {
      return next(appError("Customer not found", 404));
    }

    // Retrieve the specified pickup address coordinates from the customer data
    let pickupCoordinates;
    let pickupAddress = {};

    if (newPickupAddress) {
      pickupAddress = {
        ...newPickupAddress,
      };

      pickupCoordinates = newPickupAddress.coordinates;

      if (addNewPickupToAddressBook) {
        if (pickupAddressType === "home") {
          customer.customerDetails.homeAddress = pickupAddress;
        } else if (pickupAddressType === "work") {
          customer.customerDetails.workAddress = pickupAddress;
        } else if (pickupAddressType === "other") {
          customer.customerDetails.otherAddress.push({
            id: new mongoose.Types.ObjectId(),
            ...pickupAddress,
          });
        }

        await customer.save();
      }
    } else {
      if (pickupAddressType === "home") {
        pickupCoordinates = customer.customerDetails.homeAddress.coordinates;
        pickupAddress = { ...customer.customerDetails.homeAddress };
      } else if (pickupAddressType === "work") {
        pickupCoordinates = customer.customerDetails.workAddress.coordinates;
        pickupAddress = { ...customer.customerDetails.workAddress };
      } else {
        const otherAddress = customer.customerDetails.otherAddress.find(
          (addr) => addr.id.toString() === pickupAddressOtherAddressId
        );
        if (otherAddress) {
          pickupCoordinates = otherAddress.coordinates;
          pickupAddress = { ...otherAddress };
        } else {
          return res.status(404).json({ error: "Address not found" });
        }
      }
    }

    // Retrieve the specified drop address coordinates from the customer data
    let deliveryCoordinates;
    let deliveryAddress = {};

    if (newDropAddress) {
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

    let updatedCartDetail = {
      pickupAddress: pickupAddress._doc,
      pickupLocation: pickupCoordinates,
      deliveryAddress: deliveryAddress._doc,
      deliveryLocation: deliveryCoordinates,
      deliveryMode: "Pick and Drop",
      deliveryOption: startDate && endDate && time ? "Scheduled" : "On-demand",
      instructionInPickup,
      instructionInDelivery,
      startDate,
      endDate,
      time: time && convertToUTC(startDate, time),
    };

    if (startDate && endDate && time) {
      const startDateTime = new Date(`${startDate} ${time}`);
      const endDateTime = new Date(`${endDate} ${time}`);

      const diffTime = Math.abs(endDateTime - startDateTime);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      updatedCartDetail.numOfDays = diffDays;
    } else {
      updatedCartDetail.numOfDays = null;
    }

    // Calculate distance using MapMyIndia API
    const { distanceInKM, durationInMinutes } =
      await getDistanceFromPickupToDelivery(
        pickupCoordinates,
        deliveryCoordinates
      );

    updatedCartDetail.distance = parseFloat(distanceInKM);
    updatedCartDetail.duration = parseFloat(durationInMinutes);

    // Fetch all available vehicle types from the Agent model
    const agents = await Agent.find({});
    const vehicleTypes = agents.flatMap((agent) =>
      agent.vehicleDetail.map((vehicle) => vehicle.type)
    );
    const uniqueVehicleTypes = [...new Set(vehicleTypes)];

    // Fetch the customer pricing details for all vehicle types
    const customerPricingArray = await CustomerPricing.find({
      orderType: "Pick and Drop",
      geofenceId: customer.customerDetails.geofenceId,
      status: true,
      vehicleType: { $in: uniqueVehicleTypes },
    });

    if (!customerPricingArray || customerPricingArray.length === 0) {
      return res.status(404).json({ error: "Customer pricing not found" });
    }

    const customerSurge = await CustomerSurge.findOne({
      ruleName: "Pick And Drop Order",
      geofenceId: customer.customerDetails.geofenceId,
      status: true,
    });

    let surgeCharges;

    if (customerSurge) {
      let surgeBaseFare = customerSurge.baseFare;
      let surgeBaseDistance = customerSurge.baseDistance;
      let surgeFareAfterBaseDistance = customerSurge.fareAfterBaseDistance;

      surgeCharges = calculateDeliveryCharges(
        distanceInKM,
        surgeBaseFare,
        surgeBaseDistance,
        surgeFareAfterBaseDistance
      );
    }

    const vehicleCharges = uniqueVehicleTypes
      .map((vehicleType) => {
        const pricing = customerPricingArray.find(
          (price) => price.vehicleType === vehicleType
        );

        if (pricing) {
          const baseFare = pricing.baseFare;
          const baseDistance = pricing.baseDistance;
          const fareAfterBaseDistance = pricing.fareAfterBaseDistance;

          const deliveryCharges = calculateDeliveryCharges(
            distanceInKM,
            baseFare,
            baseDistance,
            fareAfterBaseDistance
          );

          return {
            vehicleType,
            deliveryCharges:
              parseFloat(deliveryCharges.toFixed(2)) + (surgeCharges || 0),
          };
        } else {
          return null;
        }
      })
      .filter(Boolean);

    const cartFound = await PickAndCustomCart.findOne({ customerId });

    if (cartFound) {
      await PickAndCustomCart.findByIdAndUpdate(
        cartFound._id,
        {
          cartDetail: updatedCartDetail,
        },
        {
          new: true,
        }
      );
    } else {
      await PickAndCustomCart.create({
        customerId,
        cartDetail: updatedCartDetail,
      });
    }

    res.status(200).json({
      message: "Pick and Drop locations added successfully",
      data: {
        cart: {
          ...updatedCartDetail,
          vehicleCharges,
        },
      },
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const addPickandDropItemsController = async (req, res, next) => {
  try {
    const { items, vehicleType, deliveryCharge } = req.body;
    const customerId = req.userAuth;

    // Find the cart for the customer
    const cart = await PickAndCustomCart.findOne({ customerId });

    // If cart doesn't exist, return an error
    if (!cart) {
      return res.status(404).json({
        status: "Failed",
        message: "Cart not found",
      });
    }

    // Add the new items to the cart
    items.forEach((item) => {
      const cartItem = {
        itemName: item.itemName,
        length: item.length || null,
        width: item.width || null,
        height: item.height || null,
        unit: item.unit,
        weight: item.weight,
      };
      cart.items.push(cartItem);
    });

    let updatedBill = {
      originalDeliveryCharge: deliveryCharge,
      vehicleType,
      originalGrandTotal: deliveryCharge,
    };

    cart.billDetail = updatedBill;
    await cart.save();

    res.status(200).json({
      message: "Added items to pick and drop",
      data: cart,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const addTipAndApplyPromocodeInPickAndDropController = async (
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
    const tip = parseFloat(addedTip) || 0;
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
      discountedDeliveryCharge < 0 ? 0 : discountedDeliveryCharge.toFixed(2);
    cart.billDetail.discountedGrandTotal = discountedGrandTotal.toFixed(2);
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

const confirmPickAndDropController = async (req, res, next) => {
  try {
    const customerId = req.userAuth;

    const cartFound = await PickAndCustomCart.findOne({ customerId });

    if (!cartFound) {
      return next(appError("Cart not found", 404));
    }

    const orderAmount = parseFloat(
      cartFound.billDetail.discountedGrandTotal ||
        cartFound.billDetail.originalGrandTotal
    );

    if (isNaN(orderAmount) || orderAmount <= 0) {
      return next(appError("Invalid order amount", 400));
    }

    const { success, orderId, error } = await createRazorpayOrderId(
      orderAmount
    );

    if (!success) {
      return next(appError(`Error in creating Razorpay order: ${error}`, 500));
    }

    res.status(200).json({ success: true, orderId, amount: orderAmount });
  } catch (err) {
    next(appError(err.message));
  }
};

const verifyPickAndDropPaymentController = async (req, res, next) => {
  try {
    const { paymentDetails } = req.body;
    const customerId = req.userAuth;

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return next(appError("Customer not found", 404));
    }

    const cart = await PickAndCustomCart.findOne({ customerId });
    if (!cart) {
      return next(appError("Cart not found", 404));
    }

    const isPaymentValid = await verifyPayment(paymentDetails);
    if (!isPaymentValid) {
      return next(appError("Invalid payment", 400));
    }

    const orderAmount =
      cart.billDetail.discountedGrandTotal ||
      cart.billDetail.originalGrandTotal;

    let orderBill = {
      deliveryChargePerDay: cart.billDetail.deliveryChargePerDay,
      deliveryCharge:
        cart.billDetail.discountedDeliveryCharge ||
        cart.billDetail.originalDeliveryCharge,
      discountedAmount: cart.billDetail.discountedAmount,
      grandTotal:
        cart.billDetail.discountedGrandTotal ||
        cart.billDetail.originalGrandTotal,
      addedTip: cart.billDetail.addedTip,
    };

    let customerTransation = {
      madeOn: new Date(),
      transactionType: "Bill",
      transactionAmount: orderAmount,
      type: "Debit",
    };

    let startDate, endDate, newOrder;
    if (cart.cartDetail.deliveryOption === "Scheduled") {
      startDate = convertStartDateToUTC(
        cart.cartDetail.startDate,
        cart.cartDetail.time
      );

      endDate = convertEndDateToUTC(
        cart.cartDetail.endDate,
        cart.cartDetail.time
      );

      // Create scheduled Pick and Drop
      newOrder = await ScheduledPickAndCustom.create({
        customerId,
        items: cart.items,
        orderDetail: cart.cartDetail,
        billDetail: orderBill,
        totalAmount: orderAmount,
        status: "Pending",
        paymentMode: "Online-payment",
        paymentStatus: "Completed",
        startDate,
        endDate,
        time: cart.cartDetail.time,
      });

      // Clear the cart
      await PickAndCustomCart.deleteOne({ customerId });
      customer.transactionDetail.push(customerTransation);
      await customer.save();

      res.status(200).json({
        message: "Scheduled order created successfully",
        data: newOrder,
      });
      return;
    }

    newOrder = await Order.create({
      customerId,
      items: cart.items,
      orderDetail: cart.cartDetail,
      billDetail: orderBill,
      totalAmount: orderAmount,
      status: "Pending",
      paymentMode: "Online-payment",
      paymentStatus: "Completed",
      paymentId: paymentDetails.razorpay_payment_id,
    });

    // Clear the cart
    await PickAndCustomCart.deleteOne({ customerId });
    customer.transactionDetail.push(customerTransation);
    await customer.save();

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
        instructionInDelivery: newOrder.orderDetail.instructionInDelivery,
        instructionInPickup: newOrder.orderDetail.instructionInPickup,
        distance: newOrder.orderDetail.distance,
      },
      createdAt: newOrder.createdAt,
      updatedAt: newOrder.updatedAt,
    };

    res.status(200).json({
      message: "Order created successfully",
      data: orderResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  addPickUpAddressController,
  addPickandDropItemsController,
  addTipAndApplyPromocodeInPickAndDropController,
  confirmPickAndDropController,
  verifyPickAndDropPaymentController,
};
