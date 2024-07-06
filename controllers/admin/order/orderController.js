const Customer = require("../../../models/Customer");
const Order = require("../../../models/Order");
const appError = require("../../../utils/appError");
const { formatTime, formatDate } = require("../../../utils/formatDate");
const { razorpayRefund } = require("../../../utils/razorpayPayment");

// -------------------------------------------------
// For Merchant
// -------------------------------------------------

const getAllOrdersOfMerchantController = async (req, res, next) => {
  try {
    const currentMerchant = req.userAuth;

    if (!currentMerchant) {
      return next(appError("Merchant is not authenticated", 401));
    }

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
      .sort({ createdAt: -1 });

    const formattedOrders = allOrders.map((order) => {
      const deliveryTimeMinutes = parseInt(
        order.merchantId.merchantDetail.deliveryTime,
        10
      );

      const deliveryTime = new Date(order.createdAt);
      deliveryTime.setMinutes(deliveryTime.getMinutes() + deliveryTimeMinutes);

      return {
        _id: order._id,
        orderStatus: order.status,
        merchantName: order.merchantId.merchantDetail.merchantName,
        customerName: order.customerId.fullName,
        deliveryMode: order.orderDetail.deliveryMode,
        orderDate: formatDate(order.createdAt),
        orderTime: formatTime(order.createdAt),
        deliveryTime: formatTime(deliveryTime),
        paymentMethod: order.orderDetail.paymentMethod,
        deliveryOption: order.orderDetail.deliveryOption,
        amount: order.totalAmount,
      };
    });

    res.status(200).json({
      message: "All orders of merchant",
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

    const orderFound = await Order.findById(orderId);

    if (!orderFound) {
      return next(appError("Order not found", 404));
    }

    if (orderFound.merchantId === currentMerchant) {
      orderFound.status = "On-going";

      await orderFound.save();
    } else {
      return next(appError("Access Denied", 400));
    }

    res
      .status(200)
      .json({ message: `Order with ID: ${orderFound._id} is confirmed` });
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

    const orderFound = await Order.findById(orderId);

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

const searchOrderByIdController = async (req, res, next) => {
  try {
    const currentMerchant = req.userAuth;

    if (!currentMerchant) {
      return next(appError("Merchant is not authenticated", 401));
    }

    const { query } = req.query;

    if (!query) {
      return next(appError("Order ID is required", 400));
    }

    const ordersFound = await Order.find({
      _id: query,
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
      .sort({ createdAt: -1 });

    if (ordersFound.length === 0) {
      return res.status(404).json({ message: "No orders found" });
    }

    const formattedOrders = ordersFound.map((order) => {
      const deliveryTimeMinutes = parseInt(
        order.merchantId.merchantDetail.deliveryTime,
        10
      );
      const deliveryTime = new Date(order.createdAt);
      deliveryTime.setMinutes(deliveryTime.getMinutes() + deliveryTimeMinutes);

      return {
        _id: order._id,
        orderStatus: order.status,
        merchantName: order.merchantId.merchantDetail.merchantName,
        customerName: order.customerId.fullName,
        deliveryMode: order.orderDetail.deliveryMode,
        orderDate: formatDate(order.createdAt),
        orderTime: formatTime(order.createdAt),
        deliveryTime: formatTime(deliveryTime),
        paymentMethod: order.orderDetail.paymentMethod,
        deliveryOption: order.orderDetail.deliveryOption,
        amount: order.totalAmount,
      };
    });

    res.status(200).json({
      message: "Search result of order",
      data: formattedOrders,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const filterOrdersController = async (req, res, next) => {
  try {
    const currentMerchant = req.userAuth;

    if (!currentMerchant) {
      return next(appError("Merchant is not authenticated", 401));
    }

    const { status, paymentMode, deliveryMode } = req.query;

    if (!status && !paymentMode && !deliveryMode) {
      return res
        .status(400)
        .json({ message: "At least one filter is required" });
    }

    const filterCriteria = { merchantId: currentMerchant };

    if (status) {
      filterCriteria.status = { $regex: status.trim(), $options: "i" };
    }

    if (paymentMode) {
      filterCriteria.paymentMode = {
        $regex: paymentMode.trim(),
        $options: "i",
      };
    }

    if (deliveryMode) {
      filterCriteria["orderDetail.deliveryOption"] = {
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
      .sort({ createdAt: -1 });

    const formattedOrders = filteredOrderResults.map((order) => {
      const deliveryTimeMinutes = parseInt(
        order.merchantId.merchantDetail.deliveryTime,
        10
      );
      const deliveryTime = new Date(order.createdAt);
      deliveryTime.setMinutes(deliveryTime.getMinutes() + deliveryTimeMinutes);

      return {
        _id: order._id,
        orderStatus: order.status,
        merchantName: order.merchantId.merchantDetail.merchantName,
        customerName: order.customerId.fullName,
        deliveryMode: order.orderDetail.deliveryMode,
        orderDate: formatDate(order.createdAt),
        orderTime: formatTime(order.createdAt),
        deliveryTime: formatTime(deliveryTime),
        paymentMethod: order.orderDetail.paymentMethod,
        deliveryOption: order.orderDetail.deliveryOption,
        amount: order.totalAmount,
      };
    });

    res.status(200).json({
      message: "Filtered orders",
      data: formattedOrders,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// -------------------------------------------------
// For Admin
// -------------------------------------------------

const getAllOrdersForAdminController = async (req, res, next) => {
  try {
    const allOrders = await Order.find({})
      .populate({
        path: "merchantId",
        select: "merchantDetail.merchantName merchantDetail.deliveryTime",
      })
      .populate({
        path: "customerId",
        select: "fullName",
      })
      .sort({ createdAt: -1 });

    const formattedOrders = allOrders.map((order) => {
      const deliveryTimeMinutes = parseInt(
        order.merchantId.merchantDetail.deliveryTime,
        10
      );

      const deliveryTime = new Date(order.createdAt);
      deliveryTime.setMinutes(deliveryTime.getMinutes() + deliveryTimeMinutes);

      return {
        _id: order._id,
        orderStatus: order.status,
        merchantName: order.merchantId.merchantDetail.merchantName,
        customerName: order.customerId.fullName,
        deliveryMode: order.orderDetail.deliveryMode,
        orderDate: formatDate(order.createdAt),
        orderTime: formatTime(order.createdAt),
        deliveryTime: formatTime(deliveryTime),
        paymentMethod: order.orderDetail.paymentMethod,
        deliveryOption: order.orderDetail.deliveryOption,
        amount: order.totalAmount,
      };
    });

    res.status(200).json({
      message: "All orders of merchant",
      data: formattedOrders,
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
    const { query } = req.query;

    if (!query) {
      return next(appError("Order ID is required", 400));
    }

    const ordersFound = await Order.find({
      _id: query,
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
      .sort({ createdAt: -1 });

    if (ordersFound.length === 0) {
      return res.status(404).json({ message: "No orders found" });
    }

    const formattedOrders = ordersFound.map((order) => {
      const deliveryTimeMinutes = parseInt(
        order.merchantId.merchantDetail.deliveryTime,
        10
      );
      const deliveryTime = new Date(order.createdAt);
      deliveryTime.setMinutes(deliveryTime.getMinutes() + deliveryTimeMinutes);

      return {
        _id: order._id,
        orderStatus: order.status,
        merchantName: order.merchantId.merchantDetail.merchantName,
        customerName: order.customerId.fullName,
        deliveryMode: order.orderDetail.deliveryMode,
        orderDate: formatDate(order.createdAt),
        orderTime: formatTime(order.createdAt),
        deliveryTime: formatTime(deliveryTime),
        paymentMethod: order.orderDetail.paymentMethod,
        deliveryOption: order.orderDetail.deliveryOption,
        amount: order.totalAmount,
      };
    });

    res.status(200).json({
      message: "Search result of order",
      data: formattedOrders,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const filterOrdersByAdminController = async (req, res, next) => {
  try {
    const { status, paymentMode, deliveryMode } = req.query;

    if (!status && !paymentMode && !deliveryMode) {
      return res
        .status(400)
        .json({ message: "At least one filter is required" });
    }

    const filterCriteria = {};

    if (status) {
      filterCriteria.status = { $regex: status.trim(), $options: "i" };
    }

    if (paymentMode) {
      filterCriteria.paymentMode = {
        $regex: paymentMode.trim(),
        $options: "i",
      };
    }

    if (deliveryMode) {
      filterCriteria["orderDetail.deliveryOption"] = {
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
      .sort({ createdAt: -1 });

    const formattedOrders = filteredOrderResults.map((order) => {
      const deliveryTimeMinutes = parseInt(
        order.merchantId.merchantDetail.deliveryTime,
        10
      );
      const deliveryTime = new Date(order.createdAt);
      deliveryTime.setMinutes(deliveryTime.getMinutes() + deliveryTimeMinutes);

      return {
        _id: order._id,
        orderStatus: order.status,
        merchantName: order.merchantId.merchantDetail.merchantName,
        customerName: order.customerId.fullName,
        deliveryMode: order.orderDetail.deliveryMode,
        orderDate: formatDate(order.createdAt),
        orderTime: formatTime(order.createdAt),
        deliveryTime: formatTime(deliveryTime),
        paymentMethod: order.orderDetail.paymentMethod,
        deliveryOption: order.orderDetail.deliveryOption,
        amount: order.totalAmount,
      };
    });

    res.status(200).json({
      message: "Filtered orders",
      data: formattedOrders,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  // For Merchant
  getAllOrdersOfMerchantController,
  confirmOrderController,
  rejectOrderController,
  searchOrderByIdController,
  filterOrdersController,

  // For Admin
  getAllOrdersForAdminController,
  confirmOrderByAdminContrroller,
  rejectOrderByAdminController,
  searchOrderByIdByAdminController,
  filterOrdersByAdminController,
};
