const mongoose = require("mongoose");

const Customer = require("../../models/Customer");
const CustomerPricing = require("../../models/CustomerPricing");
const PromoCode = require("../../models/PromoCode");
const Order = require("../../models/Order");
const Agent = require("../../models/Agent");
const PickAndCustomCart = require("../../models/PickAndCustomCart");
const ScheduledPickAndCustom = require("../../models/ScheduledPickAndCustom");
const CustomerSurge = require("../../models/CustomerSurge");
const TemperoryOrder = require("../../models/TemperoryOrders");
const NotificationSetting = require("../../models/NotificationSetting");

const appError = require("../../utils/appError");
const {
  getDistanceFromPickupToDelivery,
  calculateDeliveryCharges,
} = require("../../utils/customerAppHelpers");
const {
  createRazorpayOrderId,
  verifyPayment,
  razorpayRefund,
} = require("../../utils/razorpayPayment");
const {
  convertStartDateToUTC,
  convertEndDateToUTC,
  formatDate,
  formatTime,
} = require("../../utils/formatters");
const {
  deleteFromFirebase,
  uploadToFirebase,
} = require("../../utils/imageOperation");

const { sendNotification, sendSocketData } = require("../../socket/socket");
const {
  processSchedule,
  processDeliveryDetailInApp,
} = require("../../utils/createOrderHelpers");

// Add pick and drop address
const addPickUpAddressController = async (req, res, next) => {
  try {
    const {
      pickUpAddressType,
      pickUpAddressOtherAddressId,
      deliveryAddressType,
      deliveryAddressOtherAddressId,
      newPickupAddress,
      newDeliveryAddress,
      instructionInPickup,
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

    const { pickupLocation, pickupAddress, deliveryLocation, deliveryAddress } =
      await processDeliveryDetailInApp(
        customer,
        pickUpAddressType,
        pickUpAddressOtherAddressId,
        newPickupAddress,
        deliveryAddressType,
        deliveryAddressOtherAddressId,
        newDeliveryAddress
      );

    let cartFound = await PickAndCustomCart.findOne({ customerId });

    let voiceInstructionInPickupURL =
      cartFound?.cartDetail?.voiceInstructionInPickup || "";
    let voiceInstructionInDeliveryURL =
      cartFound?.cartDetail?.voiceInstructionInDelivery || "";

    if (req.files) {
      const { voiceInstructionInPickup, voiceInstructionInDelivery } =
        req.files;

      if (req.files.voiceInstructionInPickup) {
        if (voiceInstructionInPickupURL) {
          await deleteFromFirebase(voiceInstructionInPickupURL);
        }
        voiceInstructionInPickupURL = await uploadToFirebase(
          voiceInstructionInPickup[0],
          "VoiceInstructions"
        );
      }

      if (req.files.voiceInstructionInDelivery) {
        if (voiceInstructionInDeliveryURL) {
          await deleteFromFirebase(voiceInstructionInDeliveryURL);
        }
        voiceInstructionInDeliveryURL = await uploadToFirebase(
          voiceInstructionInDelivery[0],
          "VoiceInstructions"
        );
      }
    }

    let scheduled;
    if (startDate && endDate && time) {
      const ifScheduled = {
        startDate,
        endDate,
        time,
      };

      scheduled = processSchedule(ifScheduled);
    }

    let updatedCartDetail = {
      pickupAddress: pickupAddress,
      pickupLocation: pickupLocation,
      deliveryAddress: deliveryAddress,
      deliveryLocation: deliveryLocation,
      deliveryMode: "Pick and Drop",
      deliveryOption: startDate && endDate && time ? "Scheduled" : "On-demand",
      instructionInPickup,
      instructionInDelivery,
      voiceInstructionInPickup: voiceInstructionInPickupURL,
      voiceInstructionInDelivery: voiceInstructionInDeliveryURL,
      startDate: scheduled?.startDate,
      endDate: scheduled?.endDate,
      time: scheduled?.time,
    };

    if (startDate && endDate && time) {
      const diffDays = scheduled.numOfDays;

      updatedCartDetail.numOfDays = diffDays;
    } else {
      updatedCartDetail.numOfDays = null;
    }

    // Calculate distance using MapMyIndia API
    const { distanceInKM, durationInMinutes } =
      await getDistanceFromPickupToDelivery(pickupLocation, deliveryLocation);

    updatedCartDetail.distance = parseFloat(distanceInKM);
    updatedCartDetail.duration = parseFloat(durationInMinutes);

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
      cartFound = await PickAndCustomCart.create({
        customerId,
        cartDetail: updatedCartDetail,
      });
    }

    res.status(200).json({
      message: "Pick and Drop locations added successfully",
      data: cartFound._id,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get vehicle charges
const getVehiclePricingDetailsController = async (req, res, next) => {
  try {
    const customerId = req.userAuth;

    const customer = await Customer.findById(customerId);

    if (!customer) return next(appError("Customer not found", 404));

    const { cartId } = req.params;

    const cartFound = await PickAndCustomCart.findOne({
      _id: cartId,
      customerId,
    });

    if (!cartFound) return next(appError("Customer cart not found", 404));

    const agents = await Agent.find({});
    const vehicleTypes = agents.flatMap((agent) =>
      agent.vehicleDetail.map((vehicle) => vehicle.type)
    );
    const uniqueVehicleTypes = [...new Set(vehicleTypes)];

    // Fetch the customer pricing details for all vehicle types
    const customerPricingArray = await CustomerPricing.find({
      deliveryMode: "Pick and Drop",
      geofenceId: customer.customerDetails.geofenceId,
      status: true,
      vehicleType: { $in: uniqueVehicleTypes },
    });

    if (!customerPricingArray || customerPricingArray.length === 0) {
      return res.status(404).json({ error: "Customer pricing not found" });
    }

    const customerSurge = await CustomerSurge.findOne({
      geofenceId: customer.customerDetails.geofenceId,
      status: true,
    });

    let surgeCharges;

    const { distance, duration } = cartFound.cartDetail;

    if (customerSurge) {
      let surgeBaseFare = customerSurge.baseFare;
      let surgeBaseDistance = customerSurge.baseDistance;
      let surgeFareAfterBaseDistance = customerSurge.fareAfterBaseDistance;

      surgeCharges = calculateDeliveryCharges(
        distance,
        surgeBaseFare,
        surgeBaseDistance,
        surgeFareAfterBaseDistance
      );
    }

    const vehicleCharges = uniqueVehicleTypes
      ?.map((vehicleType) => {
        const pricing = customerPricingArray.find(
          (price) => price.vehicleType === vehicleType
        );

        if (pricing) {
          const baseFare = pricing.baseFare;
          const baseDistance = pricing.baseDistance;
          const fareAfterBaseDistance = pricing.fareAfterBaseDistance;

          const deliveryCharges = calculateDeliveryCharges(
            distance,
            baseFare,
            baseDistance,
            fareAfterBaseDistance
          );

          return {
            vehicleType,
            deliveryCharges: parseFloat(deliveryCharges) + (surgeCharges || 0),
          };
        } else {
          return null;
        }
      })
      .filter(Boolean);

    res.status(200).json({ distance, duration, vehicleCharges });
  } catch (err) {
    next(appError(err.message));
  }
};

// Add Items
const addPickandDropItemsController = async (req, res, next) => {
  try {
    const { items, vehicleType, deliveryCharges } = req.body;
    const customerId = req.userAuth;

    if (items.length === 0) return next(appError("Add at-least one item", 400));

    // Find the cart for the customer
    const cart = await PickAndCustomCart.findOne({ customerId });

    // If cart doesn't exist, return an error
    if (!cart) return next(appError("Cart not found", 400));

    // Clear existing items
    cart.items = [];

    // Add the new formatted items to the cart
    const formattedItems = items.map((item) => ({
      itemName: item.itemName,
      length: item.length || null,
      width: item.width || null,
      height: item.height || null,
      unit: item.unit,
      weight: item.weight,
    }));

    cart.items.push(...formattedItems);

    let updatedBill = {
      originalDeliveryCharge: Math.round(deliveryCharges),
      vehicleType,
      originalGrandTotal: Math.round(deliveryCharges),
    };

    cart.billDetail = updatedBill;
    await cart.save();

    res.status(200).json({
      message: "Added items to pick and drop",
      data: {
        cartId: cart._id,
        customerId: cart.customerId,
        cartDetail: cart.cartDetail,
        items: cart.items,
        billDetail: cart.billDetail,
      },
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Add tip and promo code
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
      data: {
        cartId: cart._id,
        customerId: cart.customerId,
        cartDetail: cart.cartDetail,
        items: cart.items,
        billDetail: { ...cart.billDetail.toObject(), taxAmount: 0 },
      },
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Confirm pick and drop
const confirmPickAndDropController = async (req, res, next) => {
  try {
    const { paymentMode } = req.body;
    const customerId = req.userAuth;

    const [customer, cart] = await Promise.all([
      Customer.findById(customerId),
      PickAndCustomCart.findOne({ customerId }),
    ]);

    if (!customer) return next(appError("Customer not found", 404));
    if (!cart) return next(appError("Cart not found", 404));

    const orderAmount = parseFloat(
      cart.billDetail.discountedGrandTotal || cart.billDetail.originalGrandTotal
    );

    if (isNaN(orderAmount) || orderAmount <= 0)
      return next(appError("Invalid order amount", 400));

    if (paymentMode === "Famto-cash") {
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

      let startDate, endDate, newOrder;
      if (cart.cartDetail.deliveryOption === "Scheduled") {
        // startDate = convertStartDateToUTC(
        //   cart.cartDetail.startDate,
        //   cart.cartDetail.time
        // );

        // endDate = convertEndDateToUTC(
        //   cart.cartDetail.endDate,
        //   cart.cartDetail.time
        // );

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
          startDate: cart.cartDetail.startDate,
          endDate: cart.cartDetail.endDate,
          time: cart.cartDetail.time,
        });

        // Clear the cart
        await PickAndCustomCart.deleteOne({ customerId });
        customer.transactionDetail.push(customerTransaction);
        customer.walletTransactionDetail.push(walletTransaction);
        await customer.save();

        res.status(200).json({
          message: "Scheduled order created successfully",
          data: newOrder,
        });
        return;
      }

      // Generate a unique order ID
      const orderId = new mongoose.Types.ObjectId();

      // Store order details temporarily in the database
      const tempOrder = await TemperoryOrder.create({
        orderId,
        customerId,
        items: cart.items,
        orderDetail: cart.cartDetail,
        billDetail: orderBill,
        totalAmount: orderAmount,
        status: "Pending",
        paymentMode: "Famto-cash",
        paymentStatus: "Completed",
      });

      customer.transactionDetail.push(customerTransaction);
      customer.walletTransactionDetail.push(walletTransaction);
      await customer.save();

      // Clear the cart
      await PickAndCustomCart.deleteOne({ customerId });

      if (!tempOrder)
        return next(appError("Error in creating temporary order"));

      // Return countdown timer to client
      res.status(200).json({
        message: "Pick and Drop order will be created in 1 minute.",
        orderId,
        countdown: 60,
      });

      setTimeout(async () => {
        const storedOrderData = await TemperoryOrder.findOne({ orderId });

        if (storedOrderData) {
          const newOrder = await Order.create({
            customerId: storedOrderData.customerId,
            items: storedOrderData.items,
            orderDetail: storedOrderData.cartDetail,
            billDetail: storedOrderData.orderBill,
            totalAmount: storedOrderData.orderAmount,
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
          await TemperoryOrder.deleteOne({ orderId });

          //? Notify the USER and ADMIN about successful order creation
          const customerData = {
            socket: {
              orderId: newOrder._id,
              orderDetail: newOrder.orderDetail,
              billDetail: newOrder.billDetail,
              orderDetailStepper: newOrder.orderDetailStepper.created,
            },
            fcm: {
              title: "Order created",
              body: "Your order was created successfully",
              image: "",
              orderId: newOrder._id,
              customerId: newOrder.customerId,
            },
          };

          const adminData = {
            socket: {
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
              orderDetailStepper: newOrder.orderDetailStepper.created,
            },
            fcm: {
              title: "New Order Admin",
              body: "Your have a new pending order",
              image: "",
              orderId: newOrder._id,
            },
          };

          const parameter = {
            eventName: "newOrderCreated",
            user: "Customer",
            role: "Admin",
          };

          sendNotification(
            newOrder.customerId,
            parameter.eventName,
            customerData,
            parameter.user
          );

          sendNotification(
            process.env.ADMIN_ID,
            parameter.eventName,
            adminData,
            parameter.role
          );
        }
      });
    } else if (paymentMode === "Online-payment") {
      const { success, orderId, error } = await createRazorpayOrderId(
        orderAmount
      );

      if (!success) {
        return next(
          appError(`Error in creating Razorpay order: ${error}`, 500)
        );
      }

      res.status(200).json({ success: true, orderId, amount: orderAmount });
    }
  } catch (err) {
    next(appError(err.message));
  }
};

// Verify pick and drop
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

    let customerTransaction = {
      madeOn: new Date(),
      transactionType: "Bill",
      transactionAmount: orderAmount,
      type: "Debit",
    };

    let newOrder;
    if (cart.cartDetail.deliveryOption === "Scheduled") {
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
        startDate: cart.cartDetail.startDate,
        endDate: cart.cartDetail.endDate,
        time: cart.cartDetail.time,
      });

      // Clear the cart
      await PickAndCustomCart.deleteOne({ customerId });
      customer.transactionDetail.push(customerTransaction);
      await customer.save();

      res.status(200).json({
        message: "Scheduled order created successfully",
        data: newOrder,
      });
      return;
    }

    // Generate a unique order ID
    const orderId = new mongoose.Types.ObjectId();

    // Store order details temporarily in the database
    const tempOrder = await TemperoryOrder.create({
      orderId,
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

    customer.transactionDetail.push(customerTransaction);
    await customer.save();

    // Clear the cart
    await PickAndCustomCart.deleteOne({ customerId });

    if (!tempOrder) {
      return next(appError("Error in creating temperory order"));
    }

    // Return countdown timer to client
    res.status(200).json({
      message: "Order will be created in 1 minute.",
      orderId,
      countdown: 60,
    });

    setTimeout(async () => {
      const storedOrderData = await TemperoryOrder.findOne({ orderId });

      if (storedOrderData) {
        const newOrder = await Order.create({
          customerId: storedOrderData.customerId,
          items: storedOrderData.items,
          orderDetail: storedOrderData.orderDetail,
          billDetail: storedOrderData.orderBill,
          totalAmount: storedOrderData.orderAmount,
          status: "Pending",
          paymentMode: "Online-payment",
          paymentStatus: "Completed",
          paymentId: storedOrderData.paymentId,
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
        await TemperoryOrder.deleteOne({ orderId });

        const eventName = "newOrderCreated";

        // Fetch notification settings to determine roles
        const notificationSettings = await NotificationSetting.findOne({
          event: eventName,
        });

        const rolesToNotify = [
          "admin",
          "merchant",
          "driver",
          "customer",
        ].filter((role) => notificationSettings[role]);

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

        const data = {
          title: notificationSettings.title,
          description: notificationSettings.description,

          orderId: newOrder._id,
          orderDetail: newOrder.orderDetail,
          billDetail: newOrder.billDetail,
          orderDetailStepper: newOrder.orderDetailStepper.created,

          //? Data for displayinf detail in all orders table
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

        sendSocketData(newOrder.customerId, eventName, data);
        sendSocketData(process.env.ADMIN_ID, eventName, data);
      }
    }, 60000);
  } catch (err) {
    next(appError(err.message));
  }
};

// Cancel order before creation
const cancelPickBeforeOrderCreationController = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const orderFound = await TemperoryOrder.findOne({ orderId });

    console.log(orderFound);

    const customerFound = await Customer.findById(orderFound.customerId);

    console.log("customer and order found");
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

        // Remove the temporary order data from the database
        await TemperoryOrder.deleteOne({ orderId });

        customerFound.transactionDetail.push(updatedTransactionDetail);

        await customerFound.save();

        res.status(200).json({
          message: "Order cancelled",
        });

        return;
      } else if (orderFound.paymentMode === "Cash-on-delivery") {
        // Remove the temporary order data from the database
        await TemperoryOrder.deleteOne({ orderId });

        res.status(200).json({ message: "Order cancelled" });

        return;
      } else if (orderFound.paymentMode === "Online-payment") {
        console.log("Inside online payment");
        const paymentId = orderFound.paymentId;

        let refundAmount;

        if (orderFound.orderDetail.deliveryOption === "On-demand") {
          refundAmount = orderFound.billDetail.grandTotal;
          updatedTransactionDetail.transactionAmount = refundAmount;

          console.log("refundAmount", refundAmount);
        } else if (orderFound.orderDetail.deliveryOption === "Scheduled") {
          refundAmount =
            orderFound.billDetail.grandTotal / orderFound.orderDetail.numOfDays;
          updatedTransactionDetail.transactionAmount = refundAmount;
        }

        const refundResponse = await razorpayRefund(paymentId, refundAmount);

        console.log("refund processed");
        if (!refundResponse.success) {
          return next(appError("Refund failed: " + refundResponse.error, 500));
        }

        customerFound.transactionDetail.push(updatedTransactionDetail);

        await customerFound.save();

        res.status(200).json({
          message: "Order cancelled",
        });

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
  addPickUpAddressController,
  getVehiclePricingDetailsController,
  addPickandDropItemsController,
  addTipAndApplyPromocodeInPickAndDropController,
  confirmPickAndDropController,
  verifyPickAndDropPaymentController,
  cancelPickBeforeOrderCreationController,
};
