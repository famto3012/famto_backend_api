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
  reduceProductAvailableQuantity,
  filterProductIdAndQuantity,
} = require("../../../utils/customerAppHelpers");
const CustomerPricing = require("../../../models/CustomerPricing");
const BusinessCategory = require("../../../models/BusinessCategory");
const CustomerSurge = require("../../../models/CustomerSurge");
const CustomerCart = require("../../../models/CustomerCart");
const {
  findOrCreateCustomer,
  getDeliveryDetails,
  processSchedule,
  calculateItemTotal,
  calculateSubTotal,
  calculateGrandTotal,
  formattedCartItems,
} = require("../../../utils/createOrderHelpers");
const Product = require("../../../models/Product");
const MerchantDiscount = require("../../../models/MerchantDiscount");
const { formatToHours } = require("../../../utils/agentAppHelpers");
const {
  sendNotification,
  findRolesToNotify,
  sendSocketData,
} = require("../../../socket/socket");
const csvWriter = require("csv-writer").createObjectCsvWriter;

const getAllOrdersOfMerchantController = async (req, res, next) => {
  try {
    // Get page and limit from query parameters with default values
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get the current authenticated merchant
    const currentMerchant = req.userAuth;

    if (!currentMerchant) {
      return next(appError("Merchant is not authenticated", 401));
    }

    // Fetch orders for the authenticated merchant with pagination
    const allOrders = await Order.find({
      merchantId: currentMerchant,
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
      .limit(limit)
      .lean(); // Convert MongoDB documents to plain JavaScript objects

    // Count total documents for the authenticated merchant
    const totalDocuments = await Order.countDocuments({
      merchantId: currentMerchant,
    });

    // Format the orders for the response
    const formattedOrders = allOrders.map((order) => {
      return {
        _id: order._id,
        orderStatus: order.status,
        merchantName: order?.merchantId?.merchantDetail?.merchantName || "-",
        customerName:
          order?.orderDetail?.deliveryAddress?.fullName ||
          order?.customerId?.fullName ||
          "-",
        deliveryMode: order?.orderDetail?.deliveryMode,
        orderDate: formatDate(order.createdAt),
        orderTime: formatTime(order.createdAt),
        deliveryTime: order?.orderDetail?.deliveryTime
          ? formatTime(order.orderDetail.deliveryTime)
          : "-",
        paymentMethod: order.paymentMode,
        deliveryOption: order.orderDetail.deliveryOption,
        amount: order.billDetail.grandTotal,
      };
    });

    // Calculate total pages
    const totalPages = Math.ceil(totalDocuments / limit);

    // Prepare pagination details
    const pagination = {
      totalDocuments,
      totalPages,
      currentPage: page,
      hasNextPage: page < totalPages,
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

const getAllScheduledOrdersOfMerchantController = async (req, res, next) => {
  try {
    // Get page and limit from query parameters with default values
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const skip = (page - 1) * limit;

    // Get the current authenticated merchant ID
    const merchantId = req.userAuth;

    if (!merchantId) {
      return next(appError("Merchant is not authenticated", 401));
    }

    // Fetch scheduled orders for the authenticated merchant with pagination
    const scheduledOrders = await ScheduledOrder.find({ merchantId })
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
      .limit(limit)
      .lean(); // Convert MongoDB documents to plain JavaScript objects

    // Format the orders for the response
    const formattedOrders = scheduledOrders.map((order) => ({
      _id: order._id,
      orderStatus: order.status,
      merchantName: order?.merchantId?.merchantDetail?.merchantName || "-",
      customerName:
        order?.orderDetail?.deliveryAddress?.fullName ||
        order?.customerId?.fullName ||
        "-",
      deliveryMode: order?.orderDetail?.deliveryMode,
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
    }));

    // Count total documents for the authenticated merchant
    const totalDocuments = await ScheduledOrder.countDocuments({ merchantId });

    // Calculate total pages
    const totalPages = Math.ceil(totalDocuments / limit);

    // Prepare pagination details
    const pagination = {
      totalDocuments,
      totalPages,
      currentPage: page,
      pageSize: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };

    res.status(200).json({
      message: "All scheduled orders of merchant",
      data: formattedOrders,
      pagination,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const confirmOrderController = async (req, res, next) => {
  try {
    const currentMerchant = req.userAuth;

    if (!currentMerchant) {
      return next(appError("Merchant is not authenticated", 401));
    }

    const { orderId } = req.params;

    let orderFound = await Order.findById(orderId);

    if (!orderFound) {
      return next(appError("Order not found", 404));
    }

    const stepperData = {
      by: "Merchant",
      userId: orderFound.merchantId,
      date: new Date(),
    };

    if (orderFound.merchantId.toString() === currentMerchant.toString()) {
      orderFound.status = "On-going";
      orderFound.orderDetailStepper.accepted = stepperData;

      const { payableAmountToFamto, payableAmountToMerchant } =
        await orderCommissionLogHelper(orderId);

      let updatedCommission = {
        merchantEarnings: payableAmountToMerchant,
        famtoEarnings: payableAmountToFamto,
      };

      orderFound.commissionDetail = updatedCommission;

      const task = await orderCreateTaskHelper(orderId);

      if (!task) {
        return next(appError("Task not created"));
      }

      await reduceProductAvailableQuantity(
        orderFound.purchasedItems,
        orderFound.merchantId
      );

      await orderFound.save();

      const eventName = "orderAccepted";

      const { rolesToNotify, data } = await findRolesToNotify(eventName);

      // Send notifications to each role dynamically
      for (const role of rolesToNotify) {
        let roleId;

        if (role === "admin") {
          roleId = process.env.ADMIN_ID;
        } else if (role === "merchant") {
          roleId = orderFound?.merchantId;
        } else if (role === "driver") {
          roleId = orderFound?.agentId;
        } else if (role === "customer") {
          roleId = orderFound?.customerId;
        }

        if (roleId) {
          const notificationData = {
            fcm: {
              orderId,
              customerId: orderFound.customerId,
              merchantId: orderFound?.merchantId,
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

        orderId: orderFound._id,
        orderDetail: orderFound.orderDetail,
        billDetail: orderFound.billDetail,
        orderDetailStepper: stepperData,
      };

      sendSocketData(orderFound.customerId, eventName, socketData);
      sendSocketData(orderFound?.merchantId, eventName, socketData);
      sendSocketData(process.env.ADMIN_ID, eventName, socketData);
    } else {
      return next(appError("Access Denied", 400));
    }

    res.status(200).json({
      message: `Order with ID: ${orderFound._id} is confirmed`,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const rejectOrderController = async (req, res, next) => {
  try {
    const currentMerchant = req.userAuth;

    if (!currentMerchant) {
      return next(appError("Merchant is not authenticated", 401));
    }

    const { orderId } = req.params;

    let orderFound = await Order.findById(orderId);

    if (!orderFound) {
      return next(appError("Order not found", 404));
    }

    if (orderFound.merchantId.toString() !== currentMerchant.toString()) {
      return next(appError("Access denied", 400));
    }

    const customerFound = await Customer.findById(orderFound.customerId);

    if (!customerFound) {
      return next(appError("Customer not found", 404));
    }

    let updatedTransactionDetail = {
      transactionType: "Refund",
      madeon: new Date(),
      type: "Credit",
      transactionAmount: null,
    };

    const stepperData = {
      by: "Merchant",
      userId: orderFound.merchantId,
      date: new Date(),
    };

    const updateOrderStatus = (order) => {
      order.status = "Cancelled";
      order.orderDetailStepper.cancelled = stepperData;
    };

    if (orderFound.paymentMode === "Famto-cash") {
      let orderAmount = orderFound.billDetail.grandTotal;

      if (orderFound.orderDetail.deliveryOption === "On-demand") {
        customerFound.customerDetails.walletBalance += orderAmount;
      } else if (orderFound.orderDetail.deliveryOption === "Scheduled") {
        const orderAmountPerDay =
          orderFound.billDetail.grandTotal / orderFound.orderDetail.numOfDays;
        customerFound.customerDetails.walletBalance += orderAmountPerDay;
      }

      updatedTransactionDetail.transactionAmount = orderAmount;
      customerFound.transactionDetail.push(updatedTransactionDetail);

      updateOrderStatus(orderFound);

      await customerFound.save();
      await orderFound.save();
    } else if (orderFound.paymentMode === "Cash-on-delivery") {
      updateOrderStatus(orderFound);

      await orderFound.save();

      orderFound = await orderFound.populate("merchantId");
    } else if (orderFound.paymentMode === "Online-payment") {
      const paymentId = orderFound.paymentId;

      if (paymentId) {
        let refundAmount;
        if (orderFound.orderDetail.deliveryOption === "On-demand") {
          refundAmount = orderFound.billDetail.grandTotal;
          updatedTransactionDetail.transactionAmount = refundAmount;
        } else if (orderFound.orderDetail.deliveryOption === "Scheduled") {
          refundAmount =
            orderFound.billDetail.grandTotal / orderFound.orderDetail.numOfDays;
          updatedTransactionDetail.transactionAmount = refundAmount;
        }

        const refundResponse = await razorpayRefund(paymentId, refundAmount);

        if (!refundResponse.success) {
          return next(appError("Refund failed: " + refundResponse.error, 500));
        }

        updatedTransactionDetail.transactionAmount = refundAmount;
        customerFound.transactionDetail.push(updatedTransactionDetail);
        orderFound.refundId = refundResponse?.refundId;
      }
      updateOrderStatus(orderFound);

      await orderFound.save();
      await customerFound.save();
    }

    const eventName = "orderRejected";

    const { rolesToNotify, data } = await findRolesToNotify(eventName);

    // Send notifications to each role dynamically
    for (const role of rolesToNotify) {
      let roleId;

      if (role === "admin") {
        roleId = process.env.ADMIN_ID;
      } else if (role === "merchant") {
        roleId = orderFound?.merchantId;
      } else if (role === "driver") {
        roleId = orderFound?.agentId;
      } else if (role === "customer") {
        roleId = orderFound?.customerId;
      }

      if (roleId) {
        const notificationData = {
          fcm: {
            orderId,
            customerId: orderFound.customerId,
            merchantId: orderFound?.merchantId,
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

      orderId: orderFound._id,
      orderDetail: orderFound.orderDetail,
      billDetail: orderFound.billDetail,
      orderDetailStepper: orderFound.orderDetailStepper.cancelled,
    };

    sendSocketData(orderFound.customerId, eventName, socketData);
    sendSocketData(orderFound?.merchantId, eventName, socketData);
    sendSocketData(process.env.ADMIN_ID, eventName, socketData);

    res.status(200).json({ message: "Order cancelled" });
  } catch (err) {
    next(appError(err.message));
  }
};

const searchOrderByIdController = async (req, res, next) => {
  try {
    const currentMerchant = req.userAuth;

    if (!currentMerchant) {
      return next(appError("Merchant is not authenticated", 401));
    }

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
      merchantId: currentMerchant,
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

    const formattedOrders = ordersFound.map((order) => {
      return {
        _id: order._id,
        orderStatus: order.status,
        merchantName: order.merchantId.merchantDetail.merchantName,
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

const searchScheduledOrderByIdController = async (req, res, next) => {
  try {
    const currentMerchant = req.userAuth;

    if (!currentMerchant) {
      return next(appError("Merchant is not authenticated", 401));
    }

    let { query, page = 1, limit = 15 } = req.query;

    if (!query) {
      return next(appError("Order ID is required", 400));
    }

    // Convert to integers
    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    // Calculate the number of documents to skip
    const skip = (page - 1) * limit;

    const ordersFound = await ScheduledOrder.find({
      _id: { $regex: query, $options: "i" },
      merchantId: currentMerchant,
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

    const formattedOrders = ordersFound.map((order) => {
      return {
        _id: order._id,
        orderStatus: order.status,
        merchantName: order.merchantId.merchantDetail.merchantName,
        customerName:
          order.orderDetail.deliveryAddress.fullName ||
          order.customerId.fullName,
        deliveryMode: order.orderDetail.deliveryMode,
        orderDate: formatDate(order.createdAt),
        orderTime: formatTime(order.createdAt),
        deliveryDate: "-",
        deliveryTime: "-",
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

const filterOrdersController = async (req, res, next) => {
  try {
    const currentMerchant = req.userAuth;

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

    const filterCriteria = { merchantId: currentMerchant };

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
        merchantName: order.merchantId.merchantDetail.merchantName,
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

const filterScheduledOrdersController = async (req, res, next) => {
  try {
    const currentMerchant = req.userAuth;

    let { status, paymentMode, deliveryMode, page = 1, limit = 15 } = req.query;

    if (!status && !paymentMode && !deliveryMode) {
      return res.status(400).json({
        message: "At least one filter is required",
      });
    }

    // Convert to integers
    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    // Calculate the number of documents to skip
    const skip = (page - 1) * limit;

    const filterCriteria = { merchantId: currentMerchant };

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

    const filteredOrderResults = await ScheduledOrder.find(filterCriteria)
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
    const totalDocuments = await ScheduledOrder.countDocuments({});

    const formattedOrders = filteredOrderResults.map((order) => {
      return {
        _id: order._id,
        orderStatus: order.status,
        merchantName: order.merchantId.merchantDetail.merchantName,
        customerName:
          order.orderDetail.deliveryAddress.fullName ||
          order.customerId.fullName,
        deliveryMode: order.orderDetail.deliveryMode,
        orderDate: formatDate(order.createdAt),
        orderTime: formatTime(order.createdAt),
        deliveryDate: "-",
        deliveryTime: "-",
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

const getOrderDetailController = async (req, res, next) => {
  try {
    const currentMerchant = req.userAuth;

    if (!currentMerchant) {
      return next(appError("Merchant is not authenticated", 401));
    }

    const { orderId } = req.params;

    const orderFound = await Order.findOne({
      _id: orderId,
      merchantId: currentMerchant,
    })
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
      orderStatus: orderFound.status || "-",
      paymentStatus: orderFound.paymentStatus || "-",
      paymentMode: orderFound.paymentMode || "-",
      deliveryMode: orderFound.orderDetail.deliveryMode || "-",
      deliveryOption: orderFound.orderDetail.deliveryOption || "-",
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
          orderFound.orderDetail.deliveryAddress.fullName ||
          "-",
        email: orderFound.customerId.email || "-",
        phone: orderFound.customerId.phoneNumber || "-",
        address: orderFound.orderDetail.deliveryAddress || "-",
        ratingsToDeliveryAgent: {
          rating: orderFound?.orderRating?.ratingToDeliveryAgent?.rating || 0,
          review: orderFound.orderRating?.ratingToDeliveryAgent.review || "-",
        },
        ratingsByDeliveryAgent: {
          rating: orderFound?.orderRating?.ratingByDeliveryAgent?.rating || 0,
          review: orderFound?.orderRating?.ratingByDeliveryAgent?.review || "-",
        },
      },
      merchantDetail: {
        _id: orderFound?.merchantId?._id || "-",
        name: orderFound?.merchantId?.merchantDetail?.merchantName || "-",
        instructionsByCustomer:
          orderFound?.orderDetail?.instructionToMerchant || "-",
        merchantEarnings: orderFound?.commissionDetail?.merchantEarnings || "-",
        famtoEarnings: orderFound?.commissionDetail?.famtoEarnings || "-",
      },
      deliveryAgentDetail: {
        _id: orderFound?.agentId?._id || "-",
        name: orderFound?.agentId?.fullName || "-",
        phoneNumber: orderFound?.agentId?.phoneNumber || "-",
        avatar: orderFound?.agentId?.agentImageURL || "-",
        team: orderFound?.agentId?.workStructure?.managerId?.name || "-",
        instructionsByCustomer:
          orderFound?.orderDetail?.instructionToDeliveryAgent || "-",
        distanceTravelled: orderFound?.orderDetail?.distance,
        timeTaken: formatToHours(orderFound?.orderDetail?.timeTaken) || "-",
        delayedBy: formatToHours(orderFound?.orderDetail?.delayedBy) || "-",
      },
      items: orderFound.items || null,
      billDetail: orderFound.billDetail || null,
      pickUpLocation: orderFound?.orderDetail?.pickupLocation || null,
      deliveryLocation: orderFound?.orderDetail?.deliveryLocation || null,
      agentLocation: orderFound?.agentId?.location || null,
      orderDetailStepper: Array.isArray(orderFound?.orderDetailStepper)
        ? orderFound.orderDetailStepper
        : [orderFound.orderDetailStepper],
    };

    res.status(200).json({
      message: "Single order detail",
      data: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getScheduledOrderDetailController = async (req, res, next) => {
  try {
    const currentMerchant = req.userAuth;

    if (!currentMerchant) {
      return next(appError("Merchant is not authenticated", 401));
    }

    const { orderId } = req.params;

    const orderFound = await ScheduledOrder.findOne({
      _id: orderId,
      merchantId: currentMerchant,
    })
      .populate({
        path: "customerId",
        select: "fullName phoneNumber email",
      })
      .populate({
        path: "merchantId",
        select: "merchantDetail",
      })
      // .populate({
      //   path: "agentId",
      //   select: "fullName workStructure",
      //   populate: {
      //     path: "workStructure.managerId",
      //     select: "name",
      //   },
      // })
      .exec();

    if (!orderFound) {
      return next(appError("Order not found", 404));
    }

    const formattedResponse = {
      _id: orderFound._id,
      orderStatus: orderFound.status || "-",
      paymentStatus: orderFound.paymentStatus || "-",
      paymentMode: orderFound.paymentMode || "-",
      deliveryMode: orderFound.orderDetail.deliveryMode || "-",
      deliveryOption: orderFound.orderDetail.deliveryOption || "-",
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
          orderFound.orderDetail.deliveryAddress.fullName ||
          "-",
        email: orderFound.customerId.email || "-",
        phone: orderFound.customerId.phoneNumber || "-",
        address: orderFound.orderDetail.deliveryAddress || "-",
        ratingsToDeliveryAgent: {
          rating: orderFound?.orderRating?.ratingToDeliveryAgent?.rating || 0,
          review: orderFound.orderRating?.ratingToDeliveryAgent.review || "-",
        },
        ratingsByDeliveryAgent: {
          rating: orderFound?.orderRating?.ratingByDeliveryAgent?.rating || 0,
          review: orderFound?.orderRating?.ratingByDeliveryAgent?.review || "-",
        },
      },
      merchantDetail: {
        _id: orderFound?.merchantId?._id || "-",
        name: orderFound?.merchantId?.merchantDetail?.merchantName || "-",
        instructionsByCustomer:
          orderFound?.orderDetail?.instructionToMerchant || "-",
        merchantEarnings: orderFound?.commissionDetail?.merchantEarnings || "-",
        famtoEarnings: orderFound?.commissionDetail?.famtoEarnings || "-",
      },
      deliveryAgentDetail: {
        _id: "-",
        name: "-",
        phoneNumber: "-",
        avatar: "-",
        team: "-",
        instructionsByCustomer: "-",
        distanceTravelled: "-",
        timeTaken: "-",
        delayedBy: "-",
      },
      items: orderFound.items || null,
      billDetail: orderFound.billDetail || null,
      pickUpLocation: orderFound?.orderDetail?.pickupLocation || null,
      deliveryLocation: orderFound?.orderDetail?.deliveryLocation || null,
      agentLocation: orderFound?.agentId?.location || null,
      orderDetailStepper: Array.isArray(orderFound?.orderDetailStepper)
        ? orderFound.orderDetailStepper
        : [orderFound.orderDetailStepper],
    };

    res.status(200).json({
      message: "Single order detail",
      data: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const createInvoiceController = async (req, res, next) => {
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
      instructionToDeliveryAgent = "",
      customerAddressType,
      customerAddressOtherAddressId,
      newCustomerAddress,
      flatDiscount,
      addedTip = 0,
    } = req.body;

    // Extract ifScheduled only if deliveryOption is scheduled
    let ifScheduled, startDate, endDate, time, numOfDays;
    if (deliveryOption === "Scheduled") {
      ifScheduled = req.body.ifScheduled;
      ({ startDate, endDate, time, numOfDays } = processSchedule(ifScheduled));
    }

    const merchantId = req.userAuth;
    const merchantFound = await Merchant.findById(merchantId);
    if (!merchantFound) return next(appError("Merchant not found", 404));

    const customerAddress = newCustomerAddress;

    let customer = await findOrCreateCustomer({
      customerId,
      newCustomer,
      customerAddress,
      formattedErrors,
    });

    if (!customer) return res.status(409).json({ errors: formattedErrors });

    let deliveryLocation, deliveryAddress, distanceInKM;
    if (deliveryMode === "Home Delivery") {
      ({ deliveryLocation, deliveryAddress } = await getDeliveryDetails({
        customer,
        customerAddressType,
        customerAddressOtherAddressId,
        newCustomer,
        newCustomerAddress,
      }));

      // return;
      const distanceData = await getDistanceFromPickupToDelivery(
        merchantFound.merchantDetail.location,
        deliveryLocation
      );
      distanceInKM = distanceData.distanceInKM;
    }

    let updatedCartDetail = {
      pickupLocation: merchantFound.merchantDetail.location,
      pickupAddress: {
        fullName: merchantFound.merchantDetail.merchantName,
        area: merchantFound.merchantDetail.displayAddress,
        phoneNumber: merchantFound.phoneNumber,
      },
      deliveryLocation,
      deliveryMode,
      deliveryOption,
      startDate,
      endDate,
      time,
      numOfDays,
    };

    if (deliveryMode === "Take Away") {
      updatedCartDetail.distance = 0;
    } else if (deliveryMode === "Home Delivery") {
      updatedCartDetail.deliveryAddress = deliveryAddress;
      updatedCartDetail.instructionToDeliveryAgent = instructionToDeliveryAgent;
      updatedCartDetail.distance = distanceInKM;
    }

    const itemTotal = calculateItemTotal(items, numOfDays);

    let oneTimeDeliveryCharge;
    let surgeCharges;
    let deliveryChargeForScheduledOrder;
    let taxAmount;

    if (deliveryMode === "Home Delivery") {
      const businessCategory = await BusinessCategory.findById(
        merchantFound.merchantDetail.businessCategoryId
      );

      if (!businessCategory)
        return next(appError("Business category not found", 404));

      console.log(deliveryMode);
      console.log(businessCategory._id);
      console.log(customer.customerDetails.geofenceId);

      const customerPricing = await CustomerPricing.findOne({
        deliveryMode,
        businessCategoryId: businessCategory._id,
        geofenceId: customer.customerDetails.geofenceId,
        status: true,
      });

      if (!customerPricing)
        return res.status(404).json({ error: "Customer pricing not found" });

      oneTimeDeliveryCharge = calculateDeliveryCharges(
        distanceInKM,
        customerPricing.baseFare,
        customerPricing.baseDistance,
        customerPricing.fareAfterBaseDistance
      );

      const customerSurge = await CustomerSurge.findOne({
        geofenceId: customer.customerDetails.geofenceId,
        status: true,
      });

      if (customerSurge) {
        surgeCharges = calculateDeliveryCharges(
          distanceInKM,
          customerSurge.baseFare,
          customerSurge.baseDistance,
          customerSurge.fareAfterBaseDistance
        );
      }

      if (startDate && endDate && time) {
        deliveryChargeForScheduledOrder = (
          oneTimeDeliveryCharge * numOfDays
        ).toFixed(2);
      }

      taxAmount = await getTaxAmount(
        businessCategory._id,
        merchantFound.merchantDetail.geofenceId,
        itemTotal,
        deliveryChargeForScheduledOrder || oneTimeDeliveryCharge
      );
    }

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
      subTotal = calculateSubTotal({
        itemTotal,
        deliveryCharge: 0,
        addedTip,
        totalDiscountAmount,
      });

      grandTotal = calculateGrandTotal({
        itemTotal,
        deliveryCharge: 0,
        addedTip,
        taxAmount: 0,
      });

      discountedGrandTotal = totalDiscountAmount
        ? (grandTotal - totalDiscountAmount).toFixed(2)
        : null;
    } else if (deliveryMode === "Home Delivery") {
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
      discountedAmount: parseFloat(totalDiscountAmount) || null,
      originalGrandTotal: Math.round(grandTotal),
      discountedGrandTotal:
        Math.round(discountedGrandTotal) || parseFloat(grandTotal),
      itemTotal,
      addedTip,
      subTotal,
      surgePrice: surgeCharges || null,
    };

    if (deliveryMode === "Take Away") {
      updatedBill.taxAmount = 0;
      updatedBill.originalDeliveryCharge = 0;
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
      billDetail: customerCart.billDetail,
      items: formattedItems,
    };

    res.status(200).json({
      message: "Order invoice created successfully",
      data: responseData,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const createOrderController = async (req, res, next) => {
  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const { paymentMode, cartId } = req.body;

    const cartFound = await CustomerCart.findById(cartId);

    if (!cartFound) {
      return next(appError("Cart not found", 404));
    }

    const customerFound = await Customer.findById(cartFound.customerId);

    if (!customerFound) {
      return next(appError("Customer not found", 404));
    }

    const merchant = await Merchant.findById(cartFound.merchantId);

    if (!merchant) {
      return next(appError("Merchant not found", 404));
    }

    const deliveryTimeMinutes = parseInt(
      merchant.merchantDetail.deliveryTime,
      10
    );

    const deliveryTime = new Date();
    deliveryTime.setMinutes(deliveryTime.getMinutes() + deliveryTimeMinutes);

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
      transactionAmount: orderBill.grandTotal,
      type: "Debit",
    };

    const deliveryOption = cartFound.cartDetail.deliveryOption;

    const populatedCartWithVariantNames = await formattedCartItems(cartFound);

    let formattedItems = populatedCartWithVariantNames.items.map((item) => {
      return {
        itemName: item.productId.productName,
        itemImageURL: item.productId.productImageURL,
        quantity: item.quantity,
        price: item.price,
        variantTypeName: item?.variantTypeId?.variantTypeName,
      };
    });

    const purchasedItems = filterProductIdAndQuantity(
      populatedCartWithVariantNames.items
    );

    const stepperData = {
      by: "Merchant",
      userId: cartFound.merchantId,
      date: new Date(),
    };

    let newOrder;
    if (paymentMode === "Cash-on-delivery") {
      if (deliveryOption === "Scheduled") {
        formattedErrors.paymentMode =
          "Scheduled orders can only be paid in advance";
        return res.status(409).json({ errors: formattedErrors });
      } else if (deliveryOption === "On-demand") {
        newOrder = await Order.create({
          customerId: customerFound._id,
          merchantId: cartFound.merchantId,
          items: formattedItems,
          orderDetail: {
            ...cartFound.cartDetail,
            deliveryTime,
          },
          billDetail: orderBill,
          totalAmount: orderBill.grandTotal,
          status: "Pending",
          paymentMode: "Cash-on-delivery",
          paymentStatus: "Pending",
          "orderDetailStepper.accepted": stepperData,
          purchasedItems,
        });

        const { payableAmountToFamto, payableAmountToMerchant } =
          await orderCommissionLogHelper(newOrder._id);

        let updatedCommission = {
          merchantEarnings: payableAmountToMerchant,
          famtoEarnings: payableAmountToFamto,
        };

        newOrder.commissionDetail = updatedCommission;

        const task = await orderCreateTaskHelper(newOrder._id);

        if (!task) {
          return next(appError("Task not created"));
        }

        await reduceProductAvailableQuantity(
          purchasedItems,
          newOrder.merchantId
        );

        await newOrder.save();

        // Clear the cart
        await CustomerCart.deleteOne({ customerId: customerFound._id });
      }
    } else if (paymentMode === "Online-payment") {
      if (deliveryOption === "Scheduled") {
        newOrder = await ScheduledOrder.create({
          customerId: customerFound._id,
          merchantId: cartFound.merchantId,
          items: formattedItems,
          orderDetail: cartFound.cartDetail,
          billDetail: orderBill,
          totalAmount: orderBill.grandTotal,
          status: "Pending",
          paymentMode: "Online-payment",
          paymentStatus: "Completed",
          startDate: cart.cartDetail.startDate,
          endDate: cart.cartDetail.endDate,
          time: cart.cartDetail.time,
          purchasedItems,
        });

        // Clear the cart
        await CustomerCart.deleteOne({ customerId: customerFound._id });

        customerFound.transactionDetail.push(customerTransation);

        newOrder.status = "On-going";

        await customerFound.save();

        res.status(200).json({
          message: "Scheduled Order created successfully",
          data: newOrder,
        });

        return;
      } else if (deliveryOption === "On-demand") {
        newOrder = await Order.create({
          customerId: customerFound._id,
          merchantId: cartFound.merchantId,
          items: formattedItems,
          orderDetail: {
            ...cartFound.cartDetail,
            deliveryTime,
          },
          billDetail: orderBill,
          totalAmount: orderBill.grandTotal,
          status: "Pending",
          paymentMode: "Online-payment",
          paymentStatus: "Completed",
          "orderDetailStepper.accepted": stepperData,
          purchasedItems,
        });

        const { payableAmountToFamto, payableAmountToMerchant } =
          await orderCommissionLogHelper(newOrder._id);

        let updatedCommission = {
          merchantEarnings: payableAmountToMerchant,
          famtoEarnings: payableAmountToFamto,
        };

        newOrder.commissionDetail = updatedCommission;

        const task = await orderCreateTaskHelper(newOrder._id);

        if (!task) {
          return next(appError("Task not created"));
        }

        await reduceProductAvailableQuantity(
          purchasedItems,
          newOrder.merchantId
        );

        newOrder.status = "On-going";

        await newOrder.save();

        // Clear the cart
        await CustomerCart.deleteOne({ customerId: customerFound._id });
      }
    }

    customerFound.transactionDetail.push(customerTransation);

    await customerFound.save();

    res.status(201).json({
      message: "Order created successfully",
      data: newOrder,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const downloadOrdersCSVByMerchantController = async (req, res, next) => {
  try {
    const { orderStatus, paymentMode, deliveryMode, query } = req.query;

    // Build query object based on filters
    const filter = {
      merchantId: req.userAuth,
    };
    if (orderStatus && orderStatus !== "All") filter.status = orderStatus;
    if (paymentMode && paymentMode !== "All") filter.paymentMode = paymentMode;
    if (deliveryMode && deliveryMode !== "All")
      filter["orderDetail.deliveryMode"] = deliveryMode;
    if (query) {
      filter.$or = [{ _id: { $regex: query, $options: "i" } }];
    }

    // Fetch the data based on filter
    let allOrders = await Order.find(filter)
      .populate("merchantId", "merchantDetail.merchantName")
      .populate("customerId", "fullName")
      .populate("agentId", "fullName")
      .sort({ createdAt: -1 })
      .exec();

    let formattedResponse = [];

    allOrders?.forEach((order) => {
      order.items.forEach((item) => {
        formattedResponse.push({
          orderId: order._id,
          status: order?.status || "-",
          merchantId: order?.merchantId?._id || "-",
          merchantName: order?.merchantId?.merchantDetail?.merchantName || "-",
          customerName: order?.customerId?.fullName || "-",
          customerPhoneNumber:
            order?.orderDetail?.deliveryAddress?.phoneNumber || "-",
          customerEmail: order?.customerId?.email || "-",
          deliveryMode: order?.orderDetail?.deliveryMode || "-",
          orderTime:
            `${formatDate(order?.createdAt)} | ${formatTime(
              order?.createdAt
            )}` || "-",
          deliveryTime:
            `${formatDate(order?.orderDetail?.deliveryTime)} | ${formatTime(
              order?.orderDetail?.deliveryTime
            )}` || "-",
          paymentMode: order?.paymentMode || "-",
          deliveryOption: order?.orderDetail?.deliveryOption || "-",
          totalAmount: order?.billDetail?.grandTotal || "-",
          deliveryAddress:
            `${order?.orderDetail?.deliveryAddress?.fullName}, ${order?.orderDetail?.deliveryAddress?.flat}, ${order?.orderDetail?.deliveryAddress?.area}, ${order?.orderDetail?.deliveryAddress?.landmark}` ||
            "-",
          distanceInKM: order?.orderDetail?.distance || "-",
          cancellationReason: order?.cancellationReason || "-",
          cancellationDescription: order?.cancellationDescription || "-",
          merchantEarnings: order?.merchantEarnings || "-",
          famtoEarnings: order?.famtoEarnings || "-",
          deliveryCharge: order?.billDetail?.deliveryCharge || "-",
          taxAmount: order?.billDetail?.taxAmount || "-",
          discountedAmount: order?.billDetail?.discountedAmount || "-",
          itemTotal: order?.billDetail?.itemTotal || "-",
          addedTip: order?.billDetail?.addedTip || "-",
          subTotal: order?.billDetail?.subTotal || "-",
          surgePrice: order?.billDetail?.surgePrice || "-",
          transactionId: order?.paymentId || "-",
          itemName: item.itemName || "-",
          quantity: item.quantity || "-",
          length: item.length || "-",
          width: item.width || "-",
          height: item.height || "-",
        });
      });
    });

    const filePath = path.join(__dirname, "../../../sample_CSV/sample_CSV.csv");

    const csvHeaders = [
      { id: "orderId", title: "Order ID" },
      { id: "status", title: "Status" },
      { id: "merchantId", title: "Merchant ID" },
      { id: "merchantName", title: "Merchant Name" },
      { id: "customerName", title: "Customer Name" },
      { id: "customerPhoneNumber", title: "Customer Phone Number" },
      { id: "customerEmail", title: "Customer Email" },
      { id: "deliveryMode", title: "Delivery Mode" },
      { id: "orderTime", title: "Order Time" },
      { id: "deliveryTime", title: "Delivery Time" },
      { id: "paymentMode", title: "Payment Mode" },
      { id: "deliveryOption", title: "Delivery Option" },
      { id: "totalAmount", title: "Total Amount" },
      { id: "deliveryAddress", title: "Delivery Address" },
      { id: "distanceInKM", title: "Distance (KM)" },
      { id: "cancellationReason", title: "Cancellation Reason" },
      { id: "cancellationDescription", title: "Cancellation Description" },
      { id: "merchantEarnings", title: "Merchant Earnings" },
      { id: "famtoEarnings", title: "Famto Earnings" },
      { id: "deliveryCharge", title: "Delivery Charge" },
      { id: "taxAmount", title: "Tax Amount" },
      { id: "discountedAmount", title: "Discounted Amount" },
      { id: "itemTotal", title: "Item Total" },
      { id: "addedTip", title: "Added Tip" },
      { id: "subTotal", title: "Sub Total" },
      { id: "surgePrice", title: "Surge Price" },
      { id: "transactionId", title: "Transaction ID" },
      { id: "itemName", title: "Item name" },
      { id: "quantity", title: "Quantity" },
      { id: "length", title: "Length" },
      { id: "width", title: "Width" },
      { id: "height", title: "height" },
    ];

    const writer = csvWriter({
      path: filePath,
      header: csvHeaders,
    });

    await writer.writeRecords(formattedResponse);

    res.status(200).download(filePath, "Order_Data.csv", (err) => {
      if (err) {
        next(err);
      }
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  getAllOrdersOfMerchantController,
  getAllScheduledOrdersOfMerchantController,
  confirmOrderController,
  rejectOrderController,
  searchOrderByIdController,
  searchScheduledOrderByIdController,
  filterOrdersController,
  filterScheduledOrdersController,
  getOrderDetailController,
  getScheduledOrderDetailController,
  createInvoiceController,
  createOrderController,
  downloadOrdersCSVByMerchantController,
};
