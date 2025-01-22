const { validationResult } = require("express-validator");
const path = require("path");
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
  reduceProductAvailableQuantity,
  filterProductIdAndQuantity,
} = require("../../../utils/customerAppHelpers");
const CustomerCart = require("../../../models/CustomerCart");
const {
  findOrCreateCustomer,
  processScheduledDelivery,
  calculateDeliveryChargesHelper,
  applyDiscounts,
  calculateBill,
  handleDeliveryMode,
  formattedCartItems,
} = require("../../../utils/createOrderHelpers");
const { formatToHours } = require("../../../utils/agentAppHelpers");
const {
  sendNotification,
  findRolesToNotify,
  sendSocketData,
} = require("../../../socket/socket");
const ActivityLog = require("../../../models/ActivityLog");
const fs = require("fs");
const Product = require("../../../models/Product");
const ManagerRoles = require("../../../models/ManagerRoles");
const Manager = require("../../../models/Manager");
const csvWriter = require("csv-writer").createObjectCsvWriter;

// TODO: Remove after panel V2
const getAllOrdersOfMerchantController = async (req, res, next) => {
  try {
    let { page = 1, limit = 50, isPaginated = "true" } = req.query;
    isPaginated = isPaginated === "true";

    const skip = (page - 1) * limit;
    const currentMerchant = req.userAuth;

    if (!currentMerchant) {
      return next(appError("Merchant is not authenticated", 401));
    }

    // Retrieve orders with pagination and sorting
    const orders = await Order.find({ merchantId: currentMerchant })
      .sort({ createdAt: -1 })
      .skip(isPaginated ? skip : 0)
      .limit(isPaginated ? limit : Number.MAX_SAFE_INTEGER);

    // Fetch product details for each order
    const orderDetails = await Promise.all(
      orders.map(async (order) => {
        const populatedOrder = await order.populate("purchasedItems.productId");

        // Format each order's purchased items
        const formattedItems = await Promise.all(
          populatedOrder.purchasedItems.map(async (item) => {
            const product = await Product.findById(item.productId);
            if (!product) return item;

            const variant = product.variants.find((variant) =>
              variant.variantTypes.some((type) =>
                type._id.equals(item.variantId)
              )
            );

            const variantType = variant
              ? variant.variantTypes.find((type) =>
                  type._id.equals(item.variantId)
                )
              : null;

            return {
              productName: product.productName,
              variantTypeName: variantType ? variantType.typeName : null,
              quantity: item.quantity,
              price: item.price,
            };
          })
        );

        return {
          _id: order._id,
          orderStatus: order.status,
          isReady: order.orderDetail.isReady,
          merchantName: order?.merchantId?.merchantDetail?.merchantName || "-",
          customerName:
            order?.customerId?.fullName ||
            order?.orderDetail?.deliveryAddress?.fullName ||
            "-",
          deliveryMode: order?.orderDetail?.deliveryMode,
          orderDate: formatDate(order.createdAt),
          orderTime: formatTime(order.createdAt),
          deliveryDate: order?.orderDetail?.deliveryTime
            ? formatDate(order.orderDetail.deliveryTime)
            : "-",
          deliveryTime: order?.orderDetail?.deliveryTime
            ? formatTime(order.orderDetail.deliveryTime)
            : "-",
          paymentMethod:
            order.paymentMode === "Cash-on-delivery"
              ? "Pay-on-delivery"
              : order.paymentMode,
          deliveryOption: order.orderDetail.deliveryOption,
          amount: order.billDetail.grandTotal,
          items: formattedItems,
        };
      })
    );

    const totalDocuments = isPaginated
      ? await Order.countDocuments({ merchantId: currentMerchant })
      : orders.length;
    const totalPages = Math.ceil(totalDocuments / limit);

    res.status(200).json({
      message: "All orders of merchant",
      data: orderDetails,
      pagination: isPaginated
        ? {
            totalDocuments,
            totalPages,
            currentPage: page,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
          }
        : undefined,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// TODO: Remove after panel V2
const searchOrderByIdController = async (req, res, next) => {
  try {
    let { query, page = 1, limit = 15 } = req.query;

    if (!query) return next(appError("Order ID is required", 400));

    // Convert to integers
    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    // Calculate the number of documents to skip
    const skip = (page - 1) * limit;

    const searchCriteria = {
      _id: { $regex: query, $options: "i" },
      merchantId: req.userAuth,
    };

    const ordersFound = await Order.find(searchCriteria)
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
      .lean();

    // Count total documents
    const totalDocuments = (await Order.countDocuments(searchCriteria)) || 1;

    const formattedOrders = ordersFound.map((order) => {
      return {
        _id: order._id,
        orderStatus: order.status,
        merchantName: order.merchantId.merchantDetail.merchantName,
        customerName:
          order.customerId.fullName ||
          order.orderDetail.deliveryAddress.fullName,
        deliveryMode: order.orderDetail.deliveryMode,
        orderDate: formatDate(order?.orderDetail?.deliveryTime),
        orderTime: formatTime(order.createdAt),
        deliveryDate: formatDate(order?.orderDetail?.deliveryTime),
        deliveryTime: formatTime(order?.orderDetail?.deliveryTime),
        paymentMethod:
          order.paymentMode === "Cash-on-delivery"
            ? "Pay-on-delivery"
            : order.paymentMode,
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

// TODO: Remove after panel V2
const filterOrdersController = async (req, res, next) => {
  try {
    let {
      status,
      paymentMode,
      deliveryMode,
      startDate,
      endDate,
      page = 1,
      limit = 15,
    } = req.query;

    // Convert to integers
    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    // Calculate the number of documents to skip
    const skip = (page - 1) * limit;

    const filterCriteria = { merchantId: req.userAuth };

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

    if (startDate && endDate) {
      startDate = new Date(startDate);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(endDate);
      endDate.setHours(23, 59, 59, 999);

      filterCriteria.createdAt = { $gte: startDate, $lte: endDate };
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
      .limit(limit)
      .lean();

    // Count total documents
    const totalDocuments = (await Order.countDocuments(filterCriteria)) || 1;

    const formattedOrders = filteredOrderResults.map((order) => {
      return {
        _id: order._id,
        orderStatus: order.status,
        merchantName: order.merchantId.merchantDetail.merchantName,
        customerName:
          order.customerId.fullName ||
          order.orderDetail.deliveryAddress.fullName,
        deliveryMode: order.orderDetail.deliveryMode,
        orderDate: formatDate(order?.orderDetail?.deliveryTime),
        orderTime: formatTime(order.createdAt),
        deliveryTime: formatTime(order?.orderDetail?.deliveryTime),
        deliveryDate: formatDate(order?.orderDetail?.deliveryTime),
        paymentMethod:
          order.paymentMode === "Cash-on-delivery"
            ? "Pay-on-delivery"
            : order.paymentMode,
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

const fetchAllOrderOfMerchant = async (req, res, next) => {
  try {
    let {
      status,
      paymentMode,
      deliveryMode,
      startDate,
      endDate,
      orderId,
      page = 1,
      limit = 50,
    } = req.query;

    // Convert to integers
    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    // Calculate the number of documents to skip
    const skip = (page - 1) * limit;

    const filterCriteria = { merchantId: req.userAuth };

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

    if (orderId && orderId !== "") {
      filterCriteria._id = { $regex: orderId.trim(), $options: "i" };
    }

    if (startDate && endDate) {
      startDate = new Date(startDate);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(endDate);
      endDate.setHours(23, 59, 59, 999);

      filterCriteria.createdAt = { $gte: startDate, $lte: endDate };
    }

    const [orders, totalCount] = await Promise.all([
      await Order.find(filterCriteria)
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
        .limit(limit),
      Order.countDocuments(filterCriteria),
    ]);

    const formattedOrders = orders?.map((order) => {
      return {
        orderId: order._id,
        orderStatus: order?.status,
        merchantName: order?.merchantId?.merchantDetail?.merchantName || "-",
        customerName:
          order?.customerId?.fullName ||
          order?.orderDetail?.deliveryAddress?.fullName ||
          null,
        deliveryMode: order?.orderDetail?.deliveryMode || null,
        orderDate: formatDate(order?.createdAt) || null,
        orderTime: formatTime(order?.createdAt) || null,
        deliveryDate: order?.orderDetail?.deliveryTime
          ? formatDate(order.orderDetail.deliveryTime)
          : "-",
        deliveryTime: order?.orderDetail?.deliveryTime
          ? formatTime(order.orderDetail.deliveryTime)
          : "-",
        paymentMethod:
          order?.paymentMode === "Cash-on-delivery"
            ? "Pay-on-delivery"
            : order?.paymentMode,
        deliveryOption: order?.orderDetail?.deliveryOption || null,
        amount: order.billDetail.grandTotal,
        isReady: order?.orderDetail?.isReady,
      };
    });

    res.status(200).json({
      totalCount,
      data: formattedOrders,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// TODO: Remove After panel V2
const getAllScheduledOrdersOfMerchantController = async (req, res, next) => {
  try {
    // Get page, limit, and pagination status from query parameters with default values
    let { page = 1, limit = 50, isPaginated = "true" } = req.query;

    isPaginated = isPaginated === "true";

    const skip = (page - 1) * limit;

    // Get the current authenticated merchant ID
    const merchantId = req.userAuth;

    if (!merchantId)
      return next(appError("Merchant is not authenticated", 401));

    let scheduledOrders;

    if (isPaginated) {
      scheduledOrders = await ScheduledOrder.find({ merchantId })
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
        .lean();
    } else {
      scheduledOrders = await ScheduledOrder.find({ merchantId })
        .populate({
          path: "merchantId",
          select: "merchantDetail.merchantName merchantDetail.deliveryTime",
        })
        .populate({
          path: "customerId",
          select: "fullName",
        })
        .sort({ createdAt: -1 })
        .lean();
    }

    // Format the orders for the response
    const formattedOrders = scheduledOrders.map((order) => ({
      _id: order._id,
      orderStatus: order.status,
      merchantName: order?.merchantId?.merchantDetail?.merchantName || "-",
      customerName:
        order?.customerId?.fullName ||
        order?.orderDetail?.deliveryAddress?.fullName ||
        "-",
      deliveryMode: order?.orderDetail?.deliveryMode,
      orderDate: formatDate(order.createdAt),
      orderTime: formatTime(order.createdAt),
      deliveryDate: order?.time ? formatDate(order.time) : "",
      deliveryTime: order?.time ? formatTime(order.time) : "",
      paymentMethod:
        order.paymentMode === "Cash-on-delivery"
          ? "Pay-on-delivery"
          : order.paymentMode,
      deliveryOption: order.orderDetail.deliveryOption,
      amount: order.billDetail.grandTotal,
      isViewed: order?.isViewed || false,
    }));

    // Count total documents for the authenticated merchant
    const [totalDocuments, totalUnSeenDocuments] = await Promise.all([
      ScheduledOrder.countDocuments({ merchantId }) || 1,
      ScheduledOrder.countDocuments({
        merchantId,
        isViewed: false,
      }),
    ]);

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
      ...(isPaginated && { pagination }),
      ...(isPaginated && { notSeen: totalUnSeenDocuments }),
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// TODO: Remove After panel V2
const searchScheduledOrderByIdController = async (req, res, next) => {
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

    const searchCriteria = {
      _id: { $regex: query, $options: "i" },
      merchantId: req.userAuth,
    };

    const ordersFound = await ScheduledOrder.find(searchCriteria)
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
      .lean();

    // Count total documents
    const totalDocuments =
      (await ScheduledOrder.countDocuments(searchCriteria)) || 1;

    const unSeenOrdersCount = ordersFound.filter(
      (order) => !order.isViewed
    ).length;

    const formattedOrders = ordersFound.map((order) => {
      return {
        _id: order._id,
        orderStatus: order.status,
        merchantName: order.merchantId.merchantDetail.merchantName,
        customerName:
          order.customerId.fullName ||
          order.orderDetail.deliveryAddress.fullName,
        deliveryMode: order.orderDetail.deliveryMode,
        orderDate: formatDate(order.createdAt),
        orderTime: formatTime(order.createdAt),
        deliveryDate: "-",
        deliveryTime: "-",
        paymentMethod:
          order.paymentMode === "Cash-on-delivery"
            ? "Pay-on-delivery"
            : order.paymentMode,
        deliveryOption: order.orderDetail.deliveryOption,
        amount: order.billDetail.grandTotal,
        isViewed: order?.isViewed || false,
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
      unSeenOrdersCount,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// TODO: Remove After panel V2
const filterScheduledOrdersController = async (req, res, next) => {
  try {
    let {
      status,
      paymentMode,
      deliveryMode,
      startDate,
      endDate,
      page = 1,
      limit = 15,
    } = req.query;

    // Convert to integers
    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    // Calculate the number of documents to skip
    const skip = (page - 1) * limit;

    const filterCriteria = { merchantId: req.userAuth };

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

    if (startDate && endDate) {
      startDate = new Date(startDate);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(endDate);
      endDate.setHours(23, 59, 59, 999);

      filterCriteria.createdAt = { $gte: startDate, $lte: endDate };
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
      .limit(limit)
      .lean();

    // Count total documents
    const totalDocuments =
      (await ScheduledOrder.countDocuments(filterCriteria)) || 1;

    const unSeenOrdersCount = filteredOrderResults.filter(
      (order) => !order.isViewed
    ).length;

    const formattedOrders = filteredOrderResults.map((order) => {
      return {
        _id: order._id,
        orderStatus: order.status,
        merchantName: order.merchantId.merchantDetail.merchantName,
        customerName:
          order.customerId.fullName ||
          order.orderDetail.deliveryAddress.fullName,
        deliveryMode: order.orderDetail.deliveryMode,
        orderDate: formatDate(order.createdAt),
        orderTime: formatTime(order.createdAt),
        deliveryDate: order?.time ? formatDate(order?.time) : "-",
        deliveryTime: order?.time ? formatTime(order?.time) : "-",
        paymentMethod:
          order.paymentMode === "Cash-on-delivery"
            ? "Pay-on-delivery"
            : order.paymentMode,
        deliveryOption: order.orderDetail.deliveryOption,
        amount: order.billDetail.grandTotal,
        isViewed: order?.isViewed || false,
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
      unSeenOrdersCount,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const fetchAllScheduledOrdersOfMerchant = async (req, res, next) => {
  try {
    let {
      status,
      paymentMode,
      deliveryMode,
      startDate,
      endDate,
      orderId,
      page = 1,
      limit = 50,
    } = req.query;

    // Convert to integers
    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    // Calculate the number of documents to skip
    const skip = (page - 1) * limit;

    const filterCriteria = { merchantId: req.userAuth };

    if (status && status.trim().toLowerCase() !== "all") {
      filterCriteria.status = { $regex: status.trim(), $options: "i" };
    }

    if (paymentMode && paymentMode.trim().toLowerCase() !== "all") {
      filterCriteria.paymentMode = {
        $regex: paymentMode.trim(),
        $options: "i",
      };
    }

    if (orderId && orderId !== "") {
      filterCriteria._id = { $regex: orderId.trim(), $options: "i" };
    }

    if (deliveryMode && deliveryMode.trim().toLowerCase() !== "all") {
      filterCriteria["orderDetail.deliveryMode"] = {
        $regex: deliveryMode.trim(),
        $options: "i",
      };
    }

    if (startDate && endDate) {
      startDate = new Date(startDate);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(endDate);
      endDate.setHours(23, 59, 59, 999);

      filterCriteria.createdAt = { $gte: startDate, $lte: endDate };
    }

    const [result, totalCOunt] = await Promise.all([
      ScheduledOrder.find(filterCriteria)
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
        .lean(),
      ScheduledOrder.countDocuments(filterCriteria),
    ]);

    const unSeenOrdersCount = result?.filter((order) => !order.isViewed).length;

    const formattedOrders = result?.map((order) => {
      return {
        orderId: order._id,
        orderStatus: order.status,
        merchantName: order.merchantId.merchantDetail.merchantName,
        customerName:
          order.customerId.fullName ||
          order.orderDetail.deliveryAddress.fullName,
        deliveryMode: order.orderDetail.deliveryMode,
        orderDate: formatDate(order.createdAt),
        orderTime: formatTime(order.createdAt),
        deliveryDate: order?.time ? formatDate(order?.time) : "-",
        deliveryTime: order?.time ? formatTime(order?.time) : "-",
        paymentMethod:
          order.paymentMode === "Cash-on-delivery"
            ? "Pay-on-delivery"
            : order.paymentMode,
        deliveryOption: order.orderDetail.deliveryOption,
        amount: order.billDetail.grandTotal,
        isViewed: order?.isViewed || false,
      };
    });

    res.status(200).json({
      notViewed: unSeenOrdersCount,
      total: totalCOunt,
      data: formattedOrders,
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

    let orderFound = await Order.findById(orderId).populate(
      "merchantId",
      "merchantDetail"
    );

    if (!orderFound) return next(appError("Order not found", 404));

    const stepperData = {
      by: "Merchant",
      userId: orderFound.merchantId,
      date: new Date(),
    };

    if (orderFound.merchantId._id.toString() === currentMerchant.toString()) {
      orderFound.status = "On-going";
      orderFound.orderDetailStepper.accepted = stepperData;

      const modelType =
        orderFound.merchantId.merchantDetail.pricing[0].modelType;

      if (modelType === "Commission") {
        const { payableAmountToFamto, payableAmountToMerchant } =
          await orderCommissionLogHelper(orderId);

        let updatedCommission = {
          merchantEarnings: payableAmountToMerchant,
          famtoEarnings: payableAmountToFamto,
        };

        orderFound.commissionDetail = updatedCommission;
      }
      if (orderFound?.orderDetail?.deliveryMode !== "Take Away") {
        const task = await orderCreateTaskHelper(orderId);

        if (!task) return next(appError("Task not created"));
      }

      await reduceProductAvailableQuantity(
        orderFound.purchasedItems,
        orderFound.merchantId
      );

      await orderFound.save();

      await ActivityLog.create({
        userId: req.userAuth,
        userType: req.userRole,
        description: `Order (#${orderId}) is confirmed by Merchant (${req.userName} - ${req.userAuth})`,
      });

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
        } else {
          const roleValue = await ManagerRoles.findOne({ roleName: role });
          let manager;
          if (roleValue) {
            manager = await Manager.findOne({ role: roleValue._id });
          } // Assuming `role` is the role field to match in Manager model
          if (manager) {
            roleId = manager._id; // Set roleId to the Manager's ID
          }
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
    const { orderId } = req.params;

    let orderFound = await Order.findById(orderId);

    if (!orderFound) return next(appError("Order not found", 404));

    const currentMerchant = req.userAuth;

    if (orderFound.merchantId.toString() !== currentMerchant.toString()) {
      return next(appError("Access denied", 400));
    }

    const customerFound = await Customer.findById(orderFound.customerId);

    if (!customerFound) {
      return next(appError("Customer not found", 404));
    }

    let updatedTransactionDetail = {
      transactionType: "Refund",
      madeOn: new Date(),
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

    await ActivityLog.create({
      userId: req.userAuth,
      userType: req.userRole,
      description: `Order (#${orderId}) is rejected by Merchant (${req.userName} - ${req.userAuth})`,
    });

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
      } else {
        const roleValue = await ManagerRoles.findOne({ roleName: role });
        let manager;
        if (roleValue) {
          manager = await Manager.findOne({ role: roleValue._id });
        } // Assuming `role` is the role field to match in Manager model
        if (manager) {
          roleId = manager._id; // Set roleId to the Manager's ID
        }
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
      scheduledOrderId: orderFound?.scheduledOrderId || null,
      orderStatus: orderFound.status || "-",
      paymentStatus: orderFound.paymentStatus || "-",
      paymentMode:
        orderFound.paymentMode === "Cash-on-delivery"
          ? "Pay-on-delivery"
          : orderFound.paymentMode || "-",
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
      .exec();

    if (!orderFound) {
      return next(appError("Order not found", 404));
    }

    const formattedResponse = {
      _id: orderFound._id,
      orderStatus: orderFound.status || "-",
      paymentStatus: orderFound.paymentStatus || "-",
      paymentMode:
        orderFound.paymentMode === "Cash-on-delivery"
          ? "Pay-on-delivery"
          : orderFound.paymentMode || "-",
      deliveryMode: orderFound.orderDetail.deliveryMode || "-",
      deliveryOption: orderFound.orderDetail.deliveryOption || "-",
      orderTime: `${formatDate(orderFound.startDate)} | ${formatTime(
        orderFound.startDate
      )} || ${formatDate(orderFound.endDate)} | ${formatTime(
        orderFound.endDate
      )}`,
      deliveryTime: `${formatDate(orderFound.time)} | ${formatTime(
        orderFound.time
      )}`,
      isViewed: orderFound?.isViewed,
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

    if (!cartFound) return next(appError("Cart not found", 404));

    const [customerFound, merchant] = await Promise.all([
      Customer.findById(cartFound.customerId),
      Merchant.findById(cartFound.merchantId),
    ]);

    if (!customerFound) return next(appError("Customer not found", 404));
    if (!merchant) return next(appError("Merchant not found", 404));

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

    let customerTransaction = {
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

    const purchasedItems = await filterProductIdAndQuantity(
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

        await ActivityLog.create({
          userId: req.userAuth,
          userType: req.userRole,
          description: `New order (#${newOrder._id}) is created by Merchant (${req.userName} - ${req.userAuth})`,
        });

        const modelType = merchant.merchantDetail.pricing[0].modelType;

        if (modelType === "Commission") {
          const { payableAmountToFamto, payableAmountToMerchant } =
            await orderCommissionLogHelper(newOrder._id);

          let updatedCommission = {
            merchantEarnings: payableAmountToMerchant,
            famtoEarnings: payableAmountToFamto,
          };

          newOrder.commissionDetail = updatedCommission;
        }

        if (newOrder?.orderDetail?.deliveryMode !== "Take Away") {
          const task = await orderCreateTaskHelper(newOrder._id);

          if (!task) {
            return next(appError("Task not created"));
          }
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
          startDate: cartFound.cartDetail.startDate,
          endDate: cartFound.cartDetail.endDate,
          time: cartFound.cartDetail.time,
          purchasedItems,
        });

        await ActivityLog.create({
          userId: req.userAuth,
          userType: req.userRole,
          description: `New scheduled order (#${newOrder._id}) is created by Merchant (${req.userName} - ${req.userAuth})`,
        });

        // Clear the cart
        await CustomerCart.deleteOne({ customerId: customerFound._id });

        customerFound.transactionDetail.push(customerTransaction);

        newOrder.status = "On-going";

        await customerFound.save();

        res.status(201).json({
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

        const modelType = merchant.merchantDetail.pricing[0].modelType;

        if (modelType === "Commission") {
          const { payableAmountToFamto, payableAmountToMerchant } =
            await orderCommissionLogHelper(newOrder._id);

          let updatedCommission = {
            merchantEarnings: payableAmountToMerchant,
            famtoEarnings: payableAmountToFamto,
          };

          newOrder.commissionDetail = updatedCommission;
        }

        if (newOrder?.orderDetail?.deliveryMode !== "Take Away") {
          const task = await orderCreateTaskHelper(newOrder._id);

          if (!task) {
            return next(appError("Task not created"));
          }
        }

        await reduceProductAvailableQuantity(
          purchasedItems,
          newOrder.merchantId
        );

        newOrder.status = "On-going";

        await newOrder.save();

        newOrder = await Order.findById(newOrder._id).populate("merchantId");

        const eventName = "newOrderCreated";

        const { rolesToNotify, data } = await findRolesToNotify(eventName);

        const socketData = {
          orderId: newOrder._id,
          orderDetail: newOrder.orderDetail,
          billDetail: newOrder.billDetail,
          orderDetailStepper: newOrder?.orderDetailStepper?.created,
          _id: newOrder._id,
          orderStatus: newOrder.status,
          merchantName:
            newOrder?.merchantId?.merchantDetail?.merchantName || "-",
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
        if (newOrder?.merchantId?._id) {
          sendSocketData(newOrder?.merchantId?._id, eventName, socketData);
        }

        // Send notifications to each role dynamically
        for (const role of rolesToNotify) {
          let roleId;

          if (role === "admin") {
            roleId = process.env.ADMIN_ID;
          } else if (role === "merchant") {
            roleId = newOrder?.merchantId?._id;
          } else if (role === "driver") {
            roleId = newOrder?.agentId;
          } else if (role === "customer") {
            roleId = newOrder?.customerId;
          } else {
            const roleValue = await ManagerRoles.findOne({ roleName: role });
            let manager;
            if (roleValue) {
              manager = await Manager.findOne({ role: roleValue._id });
            } // Assuming `role` is the role field to match in Manager model
            if (manager) {
              roleId = manager._id; // Set roleId to the Manager's ID
            }
          }

          if (roleId) {
            const notificationData = {
              fcm: {
                ...data,
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

        // Clear the cart
        await CustomerCart.deleteOne({ customerId: customerFound._id });
      }
    }

    customerFound.transactionDetail.push(customerTransaction);

    await customerFound.save();

    res.status(201).json({
      message: "Order created successfully",
      data: newOrder,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getScheduledOrderByIdForMerchant = async (req, res) => {
  try {
    const { id } = req.params;
    const merchantId = req.userAuth; // Get the order ID from the request parameters

    // Fetch the scheduled order by ID
    const scheduledOrder = await ScheduledOrder.findById(id)
      .populate({
        path: "customerId",
        select: "fullName phoneNumber email",
      })
      .populate({
        path: "merchantId",
        select: "merchantDetail",
      });

    // Check if the scheduled order exists
    if (!scheduledOrder) {
      return res.status(404).json({ message: "Scheduled order not found" });
    } else if (scheduledOrder.merchantId._id !== merchantId) {
      return res.status(404).json({ message: "Merchant not authorized" });
    }

    // Send back the scheduled order if found
    res.status(200).json(scheduledOrder);
  } catch (err) {
    // Handle any errors that occur during the process
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

    const filePath = path.join(__dirname, "../../../Order.csv");

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
      } else {
        fs.unlink(filePath, (unlinkErr) => {
          if (unlinkErr) {
            console.error("File deletion error:", unlinkErr);
          }
        });
      }
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const downloadCSVByMerchantController = async (req, res, next) => {
  try {
    const {
      type,
      status,
      paymentMode,
      deliveryMode,
      startDate,
      endDate,
      orderId,
    } = req.query;

    // Build query object based on filters
    const filter = {
      merchantId: req.userAuth,
    };
    if (status && status !== "All") filter.status = status;
    if (paymentMode && paymentMode !== "All") filter.paymentMode = paymentMode;
    if (deliveryMode && deliveryMode !== "All")
      filter["orderDetail.deliveryMode"] = deliveryMode;
    if (orderId) {
      filter.$or = [{ _id: { $regex: orderId, $options: "i" } }];
    }

    if (startDate && endDate) {
      const formattedStartDate = new Date(startDate);
      formattedStartDate.setHours(0, 0, 0, 0);

      const formattedEndDate = new Date(endDate);
      formattedEndDate.setHours(23, 59, 59, 999);

      filter.createdAt = { $gte: formattedStartDate, $lte: formattedEndDate };
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

    const filePath = path.join(__dirname, "../../../Order.csv");

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
      } else {
        fs.unlink(filePath, (unlinkErr) => {
          if (unlinkErr) {
            console.error("File deletion error:", unlinkErr);
          }
        });
      }
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
      selectedBusinessCategory,
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
      // ifScheduled,
    } = req.body;

    const merchantId = req.userAuth;
    const merchantFound = await Merchant.findById(merchantId);
    if (!merchantFound) return next(appError("Merchant not found", 404));

    const customerAddress = newCustomerAddress;

    const customer = await findOrCreateCustomer({
      customerId,
      newCustomer,
      customerAddress,
      formattedErrors,
      res,
      deliveryMode,
    });
    if (!customer) return res.status(409).json({ errors: formattedErrors });

    const {
      pickupLocation,
      pickupAddress,
      deliveryLocation,
      deliveryAddress,
      distanceInKM,
    } = await handleDeliveryMode(
      deliveryMode,
      customer,
      customerAddressType,
      customerAddressOtherAddressId,
      newCustomer,
      newCustomerAddress,
      merchantFound
    );

    const scheduledDetails = processScheduledDelivery(deliveryOption, req);

    const {
      oneTimeDeliveryCharge,
      surgeCharges,
      deliveryChargeForScheduledOrder,
      taxAmount,
      itemTotal,
    } = await calculateDeliveryChargesHelper(
      deliveryMode,
      distanceInKM,
      merchantFound,
      customer,
      items,
      scheduledDetails,
      selectedBusinessCategory
    );

    const merchantDiscountAmount = await applyDiscounts({
      items,
      itemTotal,
      merchantId,
    });

    const billDetail = calculateBill(
      itemTotal,
      deliveryChargeForScheduledOrder || oneTimeDeliveryCharge || 0,
      surgeCharges || 0,
      flatDiscount || 0,
      merchantDiscountAmount,
      taxAmount || 0,
      addedTip
    );

    const customerCart = await CustomerCart.findOneAndUpdate(
      { customerId: customer._id },
      {
        customerId: customer._id,
        merchantId,
        items,
        cartDetail: {
          ...req.body,
          pickupLocation,
          pickupAddress,
          deliveryLocation,
          deliveryAddress,
          instructionToDeliveryAgent,
          distance: distanceInKM,
          startDate: scheduledDetails?.startDate || null,
          endDate: scheduledDetails?.endDate || null,
          time: scheduledDetails?.time || null,
          numOfDays: scheduledDetails?.numOfDays || null,
        },
        billDetail: {
          ...billDetail,
          deliveryChargePerDay: oneTimeDeliveryCharge,
        },
      },
      { new: true, upsert: true }
    );

    const populatedCartWithVariantNames = await formattedCartItems(
      customerCart
    );

    const formattedItems = populatedCartWithVariantNames.items.map((item) => ({
      itemName: item.productId.productName,
      itemImageURL: item.productId.productImageURL,
      quantity: item.quantity,
      price: item.price,
      variantTypeName: item?.variantTypeId?.variantTypeName,
    }));

    res.status(200).json({
      message: "Order invoice created successfully",
      data: {
        cartId: customerCart._id,
        billDetail: customerCart.billDetail,
        items: formattedItems,
        deliveryMode,
      },
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAvailableMerchantBusinessCategoriesController = async (
  req,
  res,
  next
) => {
  try {
    const merchantId = req.userAuth;

    const merchantFound = await Merchant.findById(merchantId)
      .select("merchantDetail.businessCategoryId")
      .populate("merchantDetail.businessCategoryId", "title");

    if (!merchantFound) return next(appError("Merchant not found", 404));

    const formattedResponse =
      merchantFound?.merchantDetail?.businessCategoryId?.map((category) => ({
        _id: category._id,
        title: category.title,
      }));

    res.status(200).json({
      message: "Business categories",
      data: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const markScheduledOrderViewedController = async (req, res, next) => {
  try {
    const { orderId, merchantId } = req.params;

    const scheduledOrder = await ScheduledOrder.findOneAndUpdate(
      { _id: orderId, merchantId },
      {
        isViewed: true,
      }
    );

    if (!scheduledOrder) {
      return next(appError("Scheduled order not found", 404));
    }

    res.status(200).json({
      message: "Order viewed successfully",
      data: scheduledOrder,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const numberOfScheduledOrderNotViewedController = async (req, res, next) => {
  try {
    const { merchantId } = req.params;

    const scheduledOrder = await ScheduledOrder.find({
      merchantId,
      isViewed: false,
    });

    if (!scheduledOrder) {
      return next(appError("Scheduled order not found", 404));
    }

    res.status(200).json({
      message: "Orders not viewed",
      data: scheduledOrder?.length,
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
  getAvailableMerchantBusinessCategoriesController,
  getScheduledOrderByIdForMerchant,
  markScheduledOrderViewedController,
  numberOfScheduledOrderNotViewedController,
  //
  fetchAllOrderOfMerchant,
  fetchAllScheduledOrdersOfMerchant,
  downloadCSVByMerchantController,
};
