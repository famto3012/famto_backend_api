const { validationResult } = require("express-validator");
const Customer = require("../../../models/Customer");
const Merchant = require("../../../models/Merchant");
const Order = require("../../../models/Order");
const ScheduledOrder = require("../../../models/ScheduledOrder");
const appError = require("../../../utils/appError");
const { formatTime, formatDate } = require("../../../utils/formatters");
const {
  orderCommissionLogHelper,
} = require("../../../utils/orderCommissionLogHelper");
const {
  orderCreateTaskHelper,
} = require("../../../utils/orderCreateTaskHelper");
const { razorpayRefund } = require("../../../utils/razorpayPayment");
const {
  getDistanceFromPickupToDelivery,
  getTaxAmount,
  calculateDeliveryCharges,
} = require("../../../utils/customerAppHelpers");
const CustomerPricing = require("../../../models/CustomerPricing");
const BusinessCategory = require("../../../models/BusinessCategory");
const CustomerSurge = require("../../../models/CustomerSurge");
const CustomerCart = require("../../../models/CustomerCart");
const {
  findOrCreateCustomer,
  processSchedule,
  calculateItemTotal,
  calculateSubTotal,
  calculateGrandTotal,
  formattedCartItems,
  getPickAndDeliveryDetailForAdminOrderCreation,
  getTotalItemWeight,
  calculateAdditionalWeightCharge,
  getCustomDeliveryAddressForAdmin,
} = require("../../../utils/createOrderHelpers");
const Product = require("../../../models/Product");
const MerchantDiscount = require("../../../models/MerchantDiscount");
const Agent = require("../../../models/Agent");
const PickAndCustomCart = require("../../../models/PickAndCustomCart");
const scheduledPickAndCustom = require("../../../models/ScheduledPickAndCustom");
const { formatToHours } = require("../../../utils/agentAppHelpers");

const getAllOrdersForAdminController = async (req, res, next) => {
  try {
    // Get page and limit from query parameters
    let { page = 1, limit = 10 } = req.query;

    // Convert to integers
    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    // Calculate the number of documents to skip
    const skip = (page - 1) * limit;

    // Fetch orders with pagination
    const allOrders = await Order.find({})
      .populate({
        path: "merchantId",
        select: "merchantDetail.merchantName merchantDetail.deliveryTime",
      })
      .populate({
        path: "customerId",
        select: "fullName",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Count total documents
    const totalDocuments = await Order.countDocuments({});

    const formattedOrders = allOrders.map((order) => {
      return {
        _id: order._id,
        orderStatus: order.status,
        merchantName: order?.merchantId?.merchantDetail?.merchantName || "N/A",
        customerName:
          order.orderDetail.deliveryAddress.fullName ||
          order.customerId.fullName,
        deliveryMode: order.orderDetail.deliveryMode,
        orderDate: formatDate(order.createdAt),
        orderTime: formatTime(order.createdAt),
        deliveryDate: order?.orderDetail?.deliveryTime
          ? formatDate(order.orderDetail.deliveryTime)
          : "",
        deliveryTime: order?.orderDetail?.deliveryTime
          ? formatTime(order.orderDetail.deliveryTime)
          : "",
        paymentMethod: order.paymentMode,
        deliveryOption: order.orderDetail.deliveryOption,
        amount: order.billDetail.grandTotal,
      };
    });

    let pagination = {
      totalDocuments: totalDocuments || 0,
      totalPages: Math.ceil(totalDocuments / limit),
      currentPage: page || 1,
      pageSize: limit,
      hasNextPage: page < Math.ceil(totalDocuments / limit),
      hasPrevPage: page > 1,
    };

    res.status(200).json({
      message: "All orders of merchant",
      data: formattedOrders,
      pagination,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const confirmOrderByAdminContrroller = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const orderFound = await Order.findById(orderId);

    if (!orderFound) {
      return next(appError("Order not found", 404));
    }

    orderFound.status = "On-going";

    if (orderFound.merchantId) {
      const { payableAmountToFamto, payableAmountToMerchant } =
        await orderCommissionLogHelper(orderId);

      let updatedCommission = {
        merchantEarnings: payableAmountToMerchant,
        famtoEarnings: payableAmountToFamto,
      };
      orderFound.commissionDetail = updatedCommission;
    }

    const task = await orderCreateTaskHelper(orderId);

    if (!task) {
      return next(appError("Task not created"));
    }

    await orderFound.save();
    res
      .status(200)
      .json({ message: `Order with ID: ${orderFound._id} is confirmed` });
  } catch (err) {
    next(appError(err.message));
  }
};

const rejectOrderByAdminController = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const orderFound = await Order.findById(orderId);

    if (!orderFound) {
      return next(appError("Order not found", 404));
    }
    const customerFound = await Customer.findById(orderFound.customerId);

    if (!customerFound) {
      return next(appError("Customer not found", 404));
    }

    if (orderFound.paymentMode === "Famto-cash") {
      const orderAmount = orderFound.totalAmount;
      if (orderFound.orderDetail.deliveryOption === "On-demand") {
        customerFound.customerDetails.walletBalance += orderAmount;
      } else if (orderFound.orderDetail.deliveryOption === "Scheduled") {
        const orderAmountPerDay =
          orderFound.totalAmount / orderFound.orderDetail.numOfDays;
        customerFound.customerDetails.walletBalance += orderAmountPerDay;
      }

      orderFound.status = "Cancelled";
      await customerFound.save();
      await orderFound.save();

      res
        .status(200)
        .json({ message: "Order cancelled and amount refunded to wallet" });
      return;
    } else if (orderFound.paymentMode === "Cash-on-delivery") {
      orderFound.status === "Cancelled";

      await customerFound.save();

      res.status(200).json({ message: "Order cancelled" });
      return;
    } else if (orderFound.paymentMode === "Online-payment") {
      const paymentId = orderFound.paymentId;

      let refundAmount;
      if (orderFound.orderDetail.deliveryOption === "On-demand") {
        refundAmount = orderFound.totalAmount;
      } else if (orderFound.orderDetail.deliveryOption === "Scheduled") {
        refundAmount =
          orderFound.totalAmount / orderFound.orderDetail.numOfDays;
      }

      const refundResponse = await razorpayRefund(paymentId, refundAmount);

      if (!refundResponse.success) {
        return next(appError("Refund failed: " + refundResponse.error, 500));
      }

      orderFound.status = "Cancelled";
      orderFound.refundId = refundResponse.refundId;

      await orderFound.save();

      res.status(200).json({ message: "Order cancelled and amount refunded" });
      return;
    }
  } catch (err) {
    next(appError(err.message));
  }
};

const searchOrderByIdByAdminController = async (req, res, next) => {
  try {
    let { query, page = 1, limit = 15 } = req.query;

    if (!query) {
      return next(appError("Order ID is required", 400));
    }

    // Convert to integers
    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    // Calculate the number of documents to skip
    const skip = (page - 1) * limit;

    const ordersFound = await Order.find({
      _id: { $regex: query, $options: "i" },
    })
      .populate({
        path: "merchantId",
        select: "merchantDetail.merchantName merchantDetail.deliveryTime",
      })
      .populate({
        path: "customerId",
        select: "fullName",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Count total documents
    const totalDocuments = await Order.countDocuments({});

    const formattedOrders = ordersFound?.map((order) => {
      return {
        _id: order._id,
        orderStatus: order.status,
        merchantName: order?.merchantId?.merchantDetail?.merchantName || "N/A",
        customerName:
          order.orderDetail.deliveryAddress.fullName ||
          order.customerId.fullName,
        deliveryMode: order.orderDetail.deliveryMode,
        orderDate: formatDate(order?.orderDetail?.deliveryTime),
        orderTime: formatTime(order.createdAt),
        deliveryTime: formatTime(order?.orderDetail?.deliveryTime),
        paymentMethod: order.paymentMode,
        deliveryOption: order.orderDetail.deliveryOption,
        amount: order.billDetail.grandTotal,
      };
    });

    let pagination = {
      totalDocuments: totalDocuments || 0,
      totalPages: Math.ceil(totalDocuments / limit),
      currentPage: page || 1,
      pageSize: limit,
      hasNextPage: page < Math.ceil(totalDocuments / limit),
      hasPrevPage: page > 1,
    };

    res.status(200).json({
      message: "Search result of order",
      data: formattedOrders || [],
      pagination,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const filterOrdersByAdminController = async (req, res, next) => {
  try {
    let { status, paymentMode, deliveryMode, page = 1, limit = 15 } = req.query;

    if (!status && !paymentMode && !deliveryMode) {
      return res
        .status(400)
        .json({ message: "At least one filter is required" });
    }

    // Convert to integers
    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    // Calculate the number of documents to skip
    const skip = (page - 1) * limit;

    const filterCriteria = {};

    if (status && status.trim().toLowerCase() !== "all") {
      filterCriteria.status = { $regex: status.trim(), $options: "i" };
    }

    if (paymentMode && paymentMode.trim().toLowerCase() !== "all") {
      filterCriteria.paymentMode = {
        $regex: paymentMode.trim(),
        $options: "i",
      };
    }

    if (deliveryMode && deliveryMode.trim().toLowerCase() !== "all") {
      filterCriteria["orderDetail.deliveryMode"] = {
        $regex: deliveryMode.trim(),
        $options: "i",
      };
    }

    const filteredOrderResults = await Order.find(filterCriteria)
      .populate({
        path: "merchantId",
        select: "merchantDetail.merchantName merchantDetail.deliveryTime",
      })
      .populate({
        path: "customerId",
        select: "fullName",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Count total documents
    const totalDocuments = await Order.countDocuments({});

    const formattedOrders = filteredOrderResults.map((order) => {
      return {
        _id: order._id,
        orderStatus: order.status,
        merchantName: order?.merchantId?.merchantDetail?.merchantName || "N/A",
        customerName:
          order.orderDetail.deliveryAddress.fullName ||
          order.customerId.fullName,
        deliveryMode: order.orderDetail.deliveryMode,
        orderDate: formatDate(order?.orderDetail?.deliveryTime),
        orderTime: formatTime(order.createdAt),
        deliveryTime: formatTime(order?.orderDetail?.deliveryTime),
        paymentMethod: order.paymentMode,
        deliveryOption: order.orderDetail.deliveryOption,
        amount: order.billDetail.grandTotal,
      };
    });

    let pagination = {
      totalDocuments: totalDocuments || 0,
      totalPages: Math.ceil(totalDocuments / limit),
      currentPage: page || 1,
      pageSize: limit,
      hasNextPage: page < Math.ceil(totalDocuments / limit),
      hasPrevPage: page > 1,
    };

    res.status(200).json({
      message: "Filtered orders",
      data: formattedOrders,
      pagination,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getOrderDetailByAdminController = async (req, res, next) => {
  try {
    const currentMerchant = req.userAuth;

    if (!currentMerchant) {
      return next(appError("Merchant is not authenticated", 401));
    }

    const { orderId } = req.params;

    const orderFound = await Order.findById(orderId)
      .populate({
        path: "customerId",
        select: "fullName phoneNumber email",
      })
      .populate({
        path: "merchantId",
        select: "merchantDetail",
      })
      .populate({
        path: "agentId",
        select: "fullName workStructure",
        populate: {
          path: "workStructure.managerId",
          select: "name",
        },
      })
      .exec();

    if (!orderFound) {
      return next(appError("Order not found", 404));
    }

    const formattedResponse = {
      _id: orderFound._id,
      orderStatus: orderFound.status,
      paymentStatus: orderFound.paymentStatus,
      paymentMode: orderFound.paymentMode,
      deliveryMode: orderFound.orderDetail.deliveryMode,
      deliveryOption: orderFound.orderDetail.deliveryOption,
      orderTime: `${formatDate(orderFound.createdAt)} | ${formatTime(
        orderFound.createdAt
      )}`,
      deliveryTime: `${formatDate(
        orderFound.orderDetail.deliveryTime
      )} | ${formatTime(orderFound.orderDetail.deliveryTime)}`,
      customerDetail: {
        _id: orderFound.customerId._id,
        name:
          orderFound.customerId.fullName ||
          orderFound.orderDetail.deliveryAddress.fullName,
        email: orderFound.customerId.email || "N/A",
        phone: orderFound.customerId.phoneNumber,
        address: orderFound.orderDetail.deliveryAddress,
        ratingsToDeliveryAgent: {
          rating: orderFound?.orderRating?.ratingToDeliveryAgent?.rating || 0,
          review: orderFound.orderRating?.ratingToDeliveryAgent.review || "N/A",
        },
        ratingsByDeliveryAgent: {
          rating: orderFound?.orderRating?.ratingByDeliveryAgent?.rating || 0,
          review:
            orderFound?.orderRating?.ratingByDeliveryAgent?.review || "N/A",
        },
      },
      merchantDetail: {
        _id: orderFound?.merchantId?._id || "N/A",
        name: orderFound?.merchantId?.merchantDetail?.merchantName || "N/A",
        instructionsByCustomer:
          orderFound?.orderDetail?.instructionToMerchant || "N/A",
        merchantEarnings:
          orderFound?.commissionDetail?.merchantEarnings || "N/A",
        famtoEarnings: orderFound?.commissionDetail?.famtoEarnings || "N/A",
      },
      deliveryAgentDetail: {
        _id: orderFound?.agentId?._id || "N/A",
        name: orderFound?.agentId?.fullName,
        team: orderFound?.agentId?.workStructure?.managerId?.name,
        instructionsByCustomer:
          orderFound?.orderDetail?.instructionToDeliveryAgent || "N/A",
        distanceTravelled: orderFound?.orderDetail?.distance,
        timeTaken: formatToHours(orderFound?.orderDetail?.timeTaken) || "N/A",
        delayedBy: formatToHours(orderFound?.orderDetail?.delayedBy) || "N/A",
      },
      items: orderFound.items,
      billDetail: orderFound.billDetail,
    };

    res.status(200).json({
      message: "Single order detail",
      data: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const createInvoiceByAdminController = async (req, res, next) => {
  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const {
      customerId,
      newCustomer,
      deliveryOption,
      deliveryMode,
      items,
      instructionToMerchant,
      instructionToDeliveryAgent,
      // For Take Away and Home Delivery
      merchantId,
      customerAddressType,
      customerAddressOtherAddressId,
      flatDiscount,
      newCustomerAddress,
      // For Pick and Drop and Custom Order
      pickUpAddressType,
      pickUpAddressOtherAddressId,
      deliveryAddressType,
      deliveryAddressOtherAddressId,
      newPickupAddress,
      newDeliveryAddress,
      vehicleType,
      customPickupLocation,
      instructionInPickup,
      instructionInDelivery,
      // For all orders (Optional)
      addedTip,
    } = req.body;

    console.log("items", items);

    // Extract ifScheduled only if deliveryOption is scheduled
    let ifScheduled, startDate, endDate, time, numOfDays;
    if (deliveryOption === "Scheduled") {
      ifScheduled = req.body.ifScheduled;
      ({ startDate, endDate, time, numOfDays } = processSchedule(ifScheduled));
    }

    let merchantFound;
    if (
      merchantId &&
      (deliveryMode === "Take Away" || deliveryMode === "Home Delivery")
    ) {
      merchantFound = await Merchant.findById(merchantId);
      if (!merchantFound) return next(appError("Merchant not found", 404));
    }

    const customerAddress =
      newCustomerAddress || newPickupAddress || newDeliveryAddress;

    if (
      newCustomer &&
      deliveryMode !== "Take Away" &&
      newCustomer &&
      deliveryMode !== "Custom Order"
    ) {
      if (!customerAddress) {
        if (deliveryMode === "Home Delivery") {
          formattedErrors.customerAddress = "Customer address is required";
        } else if (deliveryMode === "Pick and Drop") {
          if (!newPickupAddress) {
            formattedErrors.pickupAddress = "Pickup address is required";
          }
          if (!newDeliveryAddress) {
            formattedErrors.deliveryAddress = "Delivery address is required";
          }
        }

        return res.status(400).json({ errors: formattedErrors });
      }
    }

    console.log("newCustomer", newCustomer);
    console.log("customerAddress", customerAddress);
    console.log("deliveryMode", deliveryMode);

    let customer = await findOrCreateCustomer({
      customerId,
      newCustomer,
      customerAddress,
      deliveryMode,
      formattedErrors,
    });

    if (!customer) return res.status(409).json({ errors: formattedErrors });

    console.log("after finding customer");

    let pickupLocation,
      pickupAddress,
      deliveryLocation,
      deliveryAddress,
      distanceInKM;

    if (deliveryMode === "Take Away") {
      pickupLocation = merchantFound.merchantDetail.location;
      pickupAddress = {
        fullName: merchantFound.merchantDetail.merchantName,
        area: merchantFound.merchantDetail.displayAddress,
        phoneNumber: merchantFound.phoneNumber,
      };
    } else if (
      deliveryMode === "Home Delivery" ||
      deliveryMode === "Pick and Drop"
    ) {
      ({ pickupLocation, pickupAddress, deliveryLocation, deliveryAddress } =
        await getPickAndDeliveryDetailForAdminOrderCreation({
          customer,
          customerAddressType,
          customerAddressOtherAddressId,
          newCustomer,
          newCustomerAddress,
          merchantFound,
          deliveryMode,
          pickUpAddressType,
          pickUpAddressOtherAddressId,
          deliveryAddressType,
          deliveryAddressOtherAddressId,
          newPickupAddress,
          newDeliveryAddress,
        }));

      // TODO: Uncomment after full testing
      const distanceData = await getDistanceFromPickupToDelivery(
        pickupLocation,
        deliveryLocation
      );
      distanceInKM = parseFloat(distanceData.distanceInKM);
      console.log("distanceInKM", distanceInKM);
    } else if (deliveryMode === "Custom Order") {
      if (customPickupLocation) {
        pickupLocation = customPickupLocation;
      }

      ({ deliveryLocation, deliveryAddress } =
        await getCustomDeliveryAddressForAdmin({
          customer,
          newCustomer,
          deliveryAddressType,
          deliveryAddressOtherAddressId,
          newDeliveryAddress,
        }));

      if (pickupLocation) {
        const distanceData = await getDistanceFromPickupToDelivery(
          pickupLocation,
          deliveryLocation
        );
        distanceInKM = parseFloat(distanceData.distanceInKM);

        // console.log("My Distance in CO", distanceInKM);
      }
    }

    let updatedCartDetail = {
      pickupLocation,
      pickupAddress,
      deliveryMode,
      deliveryOption,
      startDate,
      endDate,
      time,
      numOfDays,
    };

    // console.log("creates updated cart object", updatedCartDetail);

    if (deliveryMode === "Take Away") {
      updatedCartDetail.distance = 0;
    } else if (
      deliveryMode === "Home Delivery" ||
      deliveryMode === "Pick and Drop" ||
      deliveryMode === "Custom Order"
    ) {
      updatedCartDetail.deliveryLocation = deliveryLocation;
      updatedCartDetail.deliveryAddress = deliveryAddress;
      updatedCartDetail.instructionToDeliveryAgent = instructionToDeliveryAgent;
      updatedCartDetail.instructionToMerchant = instructionToMerchant;
      updatedCartDetail.distance = distanceInKM || 0;
    }

    // console.log("re updated details", updatedCartDetail);

    if (deliveryMode === "Take Away" || deliveryMode === "Home Delivery") {
      // console.log("Finding business category");
      const itemTotal = calculateItemTotal(items);

      const businessCategory = await BusinessCategory.findById(
        merchantFound.merchantDetail.businessCategoryId
      );

      if (!businessCategory)
        return next(appError("Business category not found", 404));

      let customerPricing;
      if (deliveryMode === "Home Delivery") {
        console.log("checking", customer.customerDetails);

        console.log("businessId", businessCategory._id);
        console.log("GeofenceId", customer.customerDetails.geofenceId);

        customerPricing = await CustomerPricing.findOne({
          deliveryMode: "Home Delivery",
          businessCategoryId: businessCategory._id,
          geofenceId: customer.customerDetails.geofenceId,
          status: true,
        });

        if (!customerPricing)
          return res.status(404).json({ error: "Customer pricing not found" });
      }

      // console.log("customerPricing", customerPricing);

      const oneTimeDeliveryCharge = calculateDeliveryCharges(
        distanceInKM,
        customerPricing?.baseFare,
        customerPricing?.baseDistance,
        customerPricing?.fareAfterBaseDistance
      );

      console.log("oneTimeDeliveryCharge", oneTimeDeliveryCharge);

      const customerSurge = await CustomerSurge.findOne({
        geofenceId: customer?.customerDetails?.geofenceId,
        status: true,
      });

      let surgeCharges;
      if (customerSurge) {
        surgeCharges = calculateDeliveryCharges(
          distanceInKM,
          customerSurge.baseFare,
          customerSurge.baseDistance,
          customerSurge.fareAfterBaseDistance
        );
      }

      let deliveryChargeForScheduledOrder;
      if (startDate && endDate && time) {
        deliveryChargeForScheduledOrder = (
          oneTimeDeliveryCharge * numOfDays
        ).toFixed(2);
      }

      const taxAmount = await getTaxAmount(
        businessCategory._id,
        merchantFound.merchantDetail.geofenceId,
        itemTotal,
        deliveryChargeForScheduledOrder || oneTimeDeliveryCharge
      );

      const discountAmount = parseFloat(flatDiscount || 0);

      let merchantDiscountAmount = 0;

      for (const item of items) {
        const product = await Product.findById(item.productId)
          .populate("discountId")
          .exec();

        if (!product) continue;

        if (product.discountId && product.discountId.status) {
          const currentDate = new Date();
          const validFrom = new Date(product.discountId.validFrom);
          const validTo = new Date(product.discountId.validTo);

          // Adjusting the validTo date to the end of the day
          validTo.setHours(23, 59, 59, 999);

          if (validFrom <= currentDate && validTo >= currentDate) {
            // Product has a valid discount, skip applying merchant discount
            continue;
          }
        }

        // Apply merchant discount to the product's price
        const merchantDiscount = await MerchantDiscount.findOne({
          merchantId,
          status: true,
        });

        if (merchantDiscount) {
          if (itemTotal < merchantDiscount.maxCheckoutValue) {
            return;
          }

          const currentDate = new Date();
          const validFrom = new Date(merchantDiscount.validFrom);
          const validTo = new Date(merchantDiscount.validTo);

          // Adjusting the validTo date to the end of the day
          validTo.setHours(23, 59, 59, 999);

          if (validFrom <= currentDate && validTo >= currentDate) {
            if (merchantDiscount.discountType === "Percentage-discount") {
              let discountValue =
                (itemTotal * merchantDiscount.discountValue) / 100;
              if (discountValue > merchantDiscount.maxDiscountValue) {
                discountValue = merchantDiscount.maxDiscountValue;
              }
              merchantDiscountAmount += discountValue;
            } else if (merchantDiscount.discountType === "Flat-discount") {
              merchantDiscountAmount += merchantDiscount.discountValue;
            }
          }
        }
      }

      const totalDiscountAmount = discountAmount + merchantDiscountAmount;

      // Calculate grandTotal without tax and deliveryCharge for Take Away
      let subTotal;
      let grandTotal;
      let discountedGrandTotal;

      if (deliveryMode === "Take Away") {
        if (deliveryOption === "On-demand") {
          subTotal = calculateSubTotal({
            itemTotal,
            deliveryCharge: 0,
            addedTip,
          });
          // console.log("here");

          grandTotal = subTotal;
        } else if (deliveryOption === "Scheduled") {
          subTotal = calculateSubTotal({
            itemTotal,
            deliveryCharge: 0,
            addedTip,
          });

          subTotal *= numOfDays;

          grandTotal = subTotal;
        }
      } else if (deliveryMode === "Home Delivery") {
        // console.log("calcualting charges of Home delivery");

        subTotal = calculateSubTotal({
          itemTotal,
          deliveryCharge:
            deliveryChargeForScheduledOrder || oneTimeDeliveryCharge,
          addedTip,
          totalDiscountAmount,
        });

        grandTotal = calculateGrandTotal({
          itemTotal,
          deliveryCharge:
            deliveryChargeForScheduledOrder || oneTimeDeliveryCharge,
          addedTip,
          taxAmount,
        });

        discountedGrandTotal = totalDiscountAmount
          ? (grandTotal - totalDiscountAmount).toFixed(2)
          : null;
      }

      let updatedBill = {
        discountedDeliveryCharge: null,
        discountedAmount:
          deliveryMode !== "Take Away"
            ? parseFloat(totalDiscountAmount) || null
            : null,
        originalGrandTotal: Math.round(grandTotal),
        discountedGrandTotal:
          Math.round(discountedGrandTotal) || parseFloat(grandTotal),
        itemTotal,
        addedTip,
        subTotal,
        surgePrice: surgeCharges || null,
      };

      if (deliveryMode === "Take Away") {
        updatedBill.taxAmount = null;
        updatedBill.originalDeliveryCharge = null;
      } else if (deliveryMode === "Home Delivery") {
        updatedBill.taxAmount = taxAmount;
        updatedBill.deliveryChargePerDay = parseFloat(oneTimeDeliveryCharge);
        updatedBill.originalDeliveryCharge = parseFloat(
          deliveryChargeForScheduledOrder || oneTimeDeliveryCharge
        );
      }

      const customerCart = await CustomerCart.findOneAndUpdate(
        { customerId: customer._id },
        {
          customerId: customer._id,
          merchantId,
          items,
          cartDetail: updatedCartDetail,
          billDetail: updatedBill,
        },
        { new: true, upsert: true }
      );

      const populatedCartWithVariantNames = await formattedCartItems(
        customerCart
      );

      let formattedItems = populatedCartWithVariantNames.items.map((item) => {
        return {
          itemName: item.productId.productName,
          itemImageURL: item.productId.productImageURL,
          quantity: item.quantity,
          price: item.price,
          variantTypeName: item?.variantTypeId?.variantTypeName,
        };
      });

      const responseData = {
        cartId: customerCart._id,
        deliveryMode: customerCart.cartDetail.deliveryMode,
        billDetail: customerCart.billDetail,
        items: formattedItems,
      };

      res.status(200).json({
        message: "Order invoice created successfully",
        data: responseData,
      });
    } else if (deliveryMode === "Pick and Drop") {
      // console.log("reached pick");
      const selectedVehicle = vehicleType;
      // console.log("selectedVehicle", selectedVehicle);

      // Fetch all available vehicle types from the Agent model
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

      // console.log("customerPricingArray", customerPricingArray);

      const customerSurge = await CustomerSurge.find({
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

      const vehiclePrice = customerPricingArray.find(
        (pricing) => pricing.vehicleType === selectedVehicle.toString()
      );

      if (!vehiclePrice) {
        return next(appError("Vehicle pricing not found", 404));
      }

      const deliveryCharges = calculateDeliveryCharges(
        distanceInKM,
        vehiclePrice.baseFare,
        vehiclePrice.baseDistance,
        vehiclePrice.fareAfterBaseDistance
      );

      const totalWeight = getTotalItemWeight(items);

      let additionalWeightCharge = calculateAdditionalWeightCharge(
        totalWeight,
        vehiclePrice.baseWeightUpto,
        vehiclePrice.fareAfterBaseWeight
      );

      console.log("deliveryCharges", deliveryCharges);
      console.log("additionalWeightCharge", additionalWeightCharge);

      const deliveryChargePerDay = (
        parseFloat(deliveryCharges) + parseFloat(additionalWeightCharge)
      ).toFixed(2);

      console.log("deliveryChargePerDay", deliveryChargePerDay);

      let originalDeliveryCharge = deliveryChargePerDay;
      if (deliveryOption === "Scheduled") {
        originalDeliveryCharge = deliveryChargePerDay * numOfDays;
      }

      const grandTotal =
        parseFloat(originalDeliveryCharge) +
        parseFloat(addedTip || 0) +
        parseFloat(surgeCharges || 0);

      let updatedBill = {
        deliveryChargePerDay,
        originalDeliveryCharge,
        originalGrandTotal: Math.round(grandTotal),
        addedTip: addedTip || null,
        subTotal: Math.round(grandTotal), // Same as grand total
        surgePrice: surgeCharges || null,
      };

      updatedCartDetail.instructionInPickup = instructionInPickup;
      updatedCartDetail.instructionInDelivery = instructionInDelivery;

      const customerCart = await PickAndCustomCart.findOneAndUpdate(
        { customerId: customer._id },
        {
          customerId: customer._id,
          cartDetail: updatedCartDetail,
          billDetail: updatedBill,
          items,
        },
        { new: true, upsert: true }
      );

      const responseData = {
        cartId: customerCart._id,
        billDetail: customerCart.billDetail,
        items: customerCart.items,
        deliveryMode: customerCart.cartDetail.deliveryMode,
      };

      res.status(200).json({
        message: "Order invoice created successfully",
        data: responseData,
      });
      return;
    } else if (deliveryMode === "Custom Order") {
      console.log("Inside custom order cart creation");

      const customerPricing = await CustomerPricing.findOne({
        deliveryMode: "Custom Order",
        geofenceId: customer.customerDetails.geofenceId,
        status: true,
      });

      const customerSurge = await CustomerSurge.find({
        geofenceId: customer.customerDetails.geofenceId,
        status: true,
      });

      if (!customerPricing) {
        return next(appError("Custom order pricing not found", 404));
      }

      let deliveryChargePerDay = null;
      let originalDeliveryCharge = null;
      let surgeCharges;

      if (distanceInKM > 0) {
        deliveryChargePerDay = calculateDeliveryCharges(
          distanceInKM,
          customerPricing.baseFare,
          customerPricing.baseDistance,
          customerPricing.fareAfterBaseDistance
        );

        if (deliveryOption === "Scheduled") {
          originalDeliveryCharge = (deliveryChargePerDay * numOfDays).toFixed(
            2
          );
        }

        if (customerSurge) {
          const surgeBaseFare = customerSurge.baseFare;
          const surgeBaseDistance = customerSurge.baseDistance;
          const surgeFareAfterBaseDistance =
            customerSurge.fareAfterBaseDistance;

          surgeCharges = calculateDeliveryCharges(
            distanceInKM,
            surgeBaseFare,
            surgeBaseDistance,
            surgeFareAfterBaseDistance
          );
        }
      }

      const grandTotal =
        parseFloat(originalDeliveryCharge || deliveryChargePerDay || 0) +
        parseFloat(addedTip || 0) +
        parseFloat(surgeCharges || 0);

      const updatedBill = {
        deliveryChargePerDay,
        originalDeliveryCharge: originalDeliveryCharge || deliveryChargePerDay,
        originalGrandTotal: Math.round(grandTotal),
        addedTip: addedTip || null,
        subTotal: Math.round(grandTotal),
        surgePrice: surgeCharges || null,
      };

      const transformedItems = items.map((item) => ({
        itemName: item.itemName,
        quantity: Number(item.quantity), // Ensure quantity is a number
        numOfUnits: Number(item.numOfUnits), // Ensure numOfUnits is a number
        itemImageURL: item?.itemImageURL,
      }));

      console.log(transformedItems);

      const customerCart = await PickAndCustomCart.findOneAndUpdate(
        { customerId: customer._id },
        {
          customerId: customer._id,
          cartDetail: updatedCartDetail,
          billDetail: updatedBill,
          items: transformedItems,
        },
        { new: true, upsert: true }
      );

      const responseData = {
        cartId: customerCart._id,
        deliveryMode: customerCart.cartDetail.deliveryMode,
        billDetail: customerCart.billDetail,
        items: customerCart.items,
      };

      res.status(200).json({
        message: "Order invoice created successfully",
        data: responseData,
      });
    }
  } catch (err) {
    next(appError(err.message));
  }
};

const createOrderByAdminController = async (req, res, next) => {
  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(400).json({ errors: formattedErrors });
  }

  try {
    const { paymentMode, deliveryMode, cartId } = req.body;

    console.log(req.body);

    let cartFound;

    if (deliveryMode === "Pick and Drop" || deliveryMode === "Custom Order") {
      cartFound = await PickAndCustomCart.findById(cartId);
    } else if (
      deliveryMode === "Take Away" ||
      deliveryMode === "Home Delivery"
    ) {
      cartFound = await CustomerCart.findById(cartId);
    }

    if (!cartFound) {
      return next(appError("Cart not found", 404));
    }

    const customer = await Customer.findById(cartFound.customerId);

    if (!customer) {
      return next(appError("Customer not found", 404));
    }

    const cartDeliveryMode = cartFound.cartDetail.deliveryMode;
    const cartDeliveryOption = cartFound.cartDetail.deliveryOption;

    const orderAmount =
      cartFound.billDetail.discountedGrandTotal ||
      cartFound.billDetail.originalGrandTotal;

    let orderBill = {
      deliveryChargePerDay: cartFound.billDetail.deliveryChargePerDay,
      deliveryCharge:
        cartFound.billDetail.discountedDeliveryCharge ||
        cartFound.billDetail.originalDeliveryCharge,
      taxAmount: cartFound.billDetail.taxAmount,
      discountedAmount: cartFound.billDetail.discountedAmount,
      grandTotal:
        cartFound.billDetail.discountedGrandTotal ||
        cartFound.billDetail.originalGrandTotal,
      itemTotal: cartFound.billDetail.itemTotal,
      addedTip: cartFound.billDetail.addedTip,
      subTotal: cartFound.billDetail.subTotal,
    };

    let customerTransation = {
      madeOn: new Date(),
      transactionType: "Bill",
      transactionAmount: orderAmount,
      type: "Debit",
    };

    let formattedItems;
    if (
      cartDeliveryMode === "Take Away" ||
      cartDeliveryMode === "Home Delivery"
    ) {
      populatedCartWithVariantNames = await formattedCartItems(cartFound);

      formattedItems = populatedCartWithVariantNames.items.map((item) => {
        return {
          itemName: item.productId.productName,
          itemImageURL: item.productId.productImageURL,
          quantity: item.quantity,
          price: item.price,
          variantTypeName: item?.variantTypeId?.variantTypeName,
        };
      });
    }

    let newOrder;

    if (
      paymentMode === "Cash-on-delivery" &&
      cartDeliveryOption === "Scheduled"
    ) {
      formattedErrors.paymentMode =
        "Scheduled orders can only be paid in online payment";
      return res.status(409).json({ errors: formattedErrors });
    }

    if (
      paymentMode === "Cash-on-delivery" &&
      cartDeliveryOption === "On-demand" &&
      (cartDeliveryMode === "Take Away" ||
        cartDeliveryMode === "Home Delivery" ||
        cartDeliveryMode === "Pick and Drop" ||
        cartDeliveryMode === "Custom Order")
    ) {
      newOrder = await Order.create({
        customerId: cartFound.customerId,
        merchantId: cartFound?.merchantId && cartFound.merchantId,
        items:
          cartDeliveryMode === "Take Away" ||
          cartDeliveryMode === "Home Delivery"
            ? formattedItems
            : cartFound.items,
        orderDetail: cartFound.cartDetail,
        billDetail: orderBill,
        totalAmount: orderAmount,
        status: "Pending",
        paymentMode: "Cash-on-delivery",
        paymentStatus: "Pending",
      });

      // Clear the cart
      if (
        cartDeliveryMode === "Take Away" ||
        cartDeliveryMode === "Home Delivery"
      ) {
        await CustomerCart.deleteOne({ customerId: customer._id });
      } else if (
        cartDeliveryMode === "Pick and Drop" ||
        cartDeliveryMode === "Custom Order"
      ) {
        await PickAndCustomCart.deleteOne({ customerId: customer._id });
      }

      customer.transactionDetail.push(customerTransation);
      await customer.save();

      res.status(201).json({
        message: "Order created successfully",
        data: newOrder,
      });
      return;
    }

    if (
      paymentMode === "Online-payment" &&
      cartDeliveryOption === "On-demand" &&
      (cartDeliveryMode === "Take Away" ||
        cartDeliveryMode === "Home Delivery" ||
        cartDeliveryMode === "Pick and Drop" ||
        cartDeliveryMode === "Custom Order")
    ) {
      console.log("before creating order in P&D");
      newOrder = await Order.create({
        customerId: cartFound.customerId,
        merchantId: cartFound?.merchantId && cartFound.merchantId,
        items:
          cartDeliveryMode === "Take Away" ||
          cartDeliveryMode === "Home Delivery"
            ? formattedItems
            : cartFound.items,
        orderDetail: cartFound.cartDetail,
        billDetail: orderBill,
        totalAmount: orderAmount,
        status: "Pending",
        paymentMode: "Online-payment",
        paymentStatus: "Completed",
      });

      // Clear the cart
      if (
        cartDeliveryMode === "Take Away" ||
        cartDeliveryMode === "Home Delivery"
      ) {
        await PickAndCustomCart.deleteOne({ customerId: customer._id });
      } else {
        await CustomerCart.deleteOne({ customerId: customer._id });
      }
      customer.transactionDetail.push(customerTransation);
      await customer.save();

      return res.status(201).json({
        message: "Order created successfully",
        data: newOrder,
      });
    }

    if (
      paymentMode === "Online-payment" &&
      cartDeliveryOption === "Scheduled" &&
      (cartDeliveryMode === "Take Away" || cartDeliveryMode === "Home Delivery")
    ) {
      newOrder = await ScheduledOrder.create({
        customerId: cartFound.customerId,
        merchantId: cartFound.merchantId,
        items: formattedItems,
        orderDetail: cartFound.cartDetail,
        billDetail: orderBill,
        totalAmount: orderAmount,
        status: "Pending",
        paymentMode: "Online-payment",
        paymentStatus: "Completed",
        startDate: cartFound.cartDetail.startDate,
        endDate: cartFound.cartDetail.endDate,
        time: cartFound.cartDetail.time,
      });

      // Clear the cart
      await CustomerCart.deleteOne({ customerId: customer._id });
      customer.transactionDetail.push(customerTransation);
      await customer.save();

      return res.status(201).json({
        message: "Scheduled order created successfully",
        data: newOrder,
      });
    }

    if (
      paymentMode === "Online-payment" &&
      cartDeliveryOption === "Scheduled" &&
      (cartDeliveryMode === "Pick and Drop" ||
        cartDeliveryMode === "Custom Order")
    ) {
      newOrder = await scheduledPickAndCustom.create({
        customerId: cartFound.customerId,
        items: cartFound.items,
        orderDetail: cartFound.cartDetail,
        billDetail: orderBill,
        totalAmount: orderAmount,
        status: "Pending",
        paymentMode: "Online-payment",
        paymentStatus: "Completed",
        startDate: cartFound.cartDetail.startDate,
        endDate: cartFound.cartDetail.endDate,
        time: cartFound.cartDetail.time,
      });

      // Clear the cart
      await PickAndCustomCart.deleteOne({ customerId: customer._id });
      customer.transactionDetail.push(customerTransation);
      await customer.save();

      res.status(201).json({
        message: "Order created successfully",
        data: newOrder,
      });
      return;
    }

    res.status(200).json({ cartFound });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  getAllOrdersForAdminController,
  confirmOrderByAdminContrroller,
  rejectOrderByAdminController,
  searchOrderByIdByAdminController,
  filterOrdersByAdminController,
  getOrderDetailByAdminController,
  createInvoiceByAdminController,
  createOrderByAdminController,
};
