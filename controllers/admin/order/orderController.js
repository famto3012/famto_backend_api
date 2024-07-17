const Customer = require("../../../models/Customer");
const Order = require("../../../models/Order");
const appError = require("../../../utils/appError");
const { formatTime, formatDate } = require("../../../utils/formatters");
const {
  orderCommissionLogHelper,
} = require("../../../utils/orderCommissionLogHelper");
const {
  orderCreateTaskHelper,
} = require("../../../utils/orderCreateTaskHelper");
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

    if (orderFound.merchantId.toString() === currentMerchant.toString()) {
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

    let updatedTransactionDetail = {
      transactionType: "Refund",
      madeon: new Date(),
      type: "Credit",
    };

    if (orderFound.paymentMode === "Famto-cash") {
      const orderAmount = orderFound.billDetail.grandTotal;
      if (orderFound.orderDetail.deliveryOption === "On-demand") {
        customerFound.customerDetails.walletBalance += orderAmount;
        updatedTransactionDetail.transactionAmount = orderAmount;
      } else if (orderFound.orderDetail.deliveryOption === "Scheduled") {
        const orderAmountPerDay =
          orderFound.billDetail.grandTotal / orderFound.orderDetail.numOfDays;
        customerFound.customerDetails.walletBalance += orderAmountPerDay;
        updatedTransactionDetail.transactionAmount = orderAmount;
      }

      orderFound.status = "Cancelled";
      customerFound.transactionDetail.push(updatedTransactionDetail);

      await customerFound.save();
      await orderFound.save();

      res
        .status(200)
        .json({ message: "Order cancelled and amount refunded to wallet" });
      return;
    } else if (orderFound.paymentMode === "Cash-on-delivery") {
      orderFound.status === "Cancelled";

      await orderFound.save();

      res.status(200).json({ message: "Order cancelled" });
      return;
    } else if (orderFound.paymentMode === "Online-payment") {
      const paymentId = orderFound.paymentId;

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

      orderFound.status = "Cancelled";
      orderFound.refundId = refundResponse.refundId;
      customerFound.transactionDetail.push(updatedTransactionDetail);

      await orderFound.save();
      await customerFound.save();

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
      )} | ${formatTime(orderDeliveryTime)}`,
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
        _id: orderFound.merchantId._id,
        name: orderFound.merchantId.merchantDetail.merchantName,
        instructionsByCustomer:
          orderFound.orderDetail.instructionToMerchant || "N/A",
        merchantEarnings:
          orderFound?.commissionDetail?.merchantEarnings || "N/A",
        famtoEarnings: orderFound?.commissionDetail?.famtoEarnings || "N/A",
      },
      deliveryAgentDetail: {
        _id: orderFound?.agentId?._id || "N/A",
        name: orderFound?.agentId?.fullName,
        team: orderFound?.agentId?.workStructure?.managerId?.name,
        instructionsByCustomer:
          orderFound.orderDetail.instructionToDeliveryAgent || "N/A",
        distanceTravelled: orderFound.orderDetail.distance,
        tmeTaken: "N/A", // TODO: Calculate these values
        delayedBy: "N/A", // TODO: Calculate these values
      },
      items: orderFound.items,
      billDetail: orderFound.billDetail,
    };

    res.status(200).json({
      message: "Single order detail",
      data: formattedResponse, //populatedOrderWithVariantNames,
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
      return {
        _id: order._id,
        orderStatus: order.status,
        merchantName: order.merchantId.merchantDetail.merchantName,
        customerName: order.customerId.fullName,
        deliveryMode: order.orderDetail.deliveryMode,
        orderDate: formatDate(order?.orderDetail?.deliveryTime),
        orderTime: formatTime(order?.orderDetail?.deliveryTime),
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
      )} | ${formatTime(orderDeliveryTime)}`,
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
        tmeTaken: "N/A", // TODO: Calculate these values
        delayedBy: "N/A", // TODO: Calculate these values
      },
      items: orderFound.items,
      billDetail: orderFound.billDetail,
    };

    res.status(200).json({
      message: "Single order detail",
      data: formattedResponse, //populatedOrderWithVariantNames,
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
  getOrderDetailController,

  // For Admin
  getAllOrdersForAdminController,
  confirmOrderByAdminContrroller,
  rejectOrderByAdminController,
  searchOrderByIdByAdminController,
  filterOrdersByAdminController,
  getOrderDetailByAdminController,
};
