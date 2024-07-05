const Order = require("../../../models/Order");
const appError = require("../../../utils/appError");
const { formatTime, formatDate } = require("../../../utils/formatDate");

const getAllOrdersOfMerchantController = async (req, res, next) => {
  try {
    const currentMercahant = req.userAuth;

    if (!currentMercahant) {
      return next(appError("Merchant is not authenticated", 401));
    }

    const allOrders = await Order.find({
      merchantId: currentMercahant,
    })
      .populate({
        path: "merchantId",
        select: "merchantDetail.merchantName",
      })
      .populate({
        path: "customerId",
        select: "fullName",
      })
      .sort({ createdAt: -1 });

    const formattedOrders = allOrders.map((order) => ({
      _id: order._id,
      orderStatus: order.status,
      merchantName: order.merchantId.merchantDetail.merchantName,
      customerName: order.customerId.fullName,
      deliveryMode: order.orderDetail.deliveryMode,
      orderDate: formatDate(order.createdAt),
      orderTime: formatTime(order.createdAt),
      deliveryTime: "N/A",
      paymentMethod: order.orderDetail.paymentMethod,
      //   TODO: Need to add option (ondemand or Scheduled)
      //   deliveryOption: order.orderDetail.deliveryMode,
      amount: order.totalAmount,
    }));

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
    const currentMercahant = req.userAuth;

    if (!currentMercahant) {
      return next(appError("Merchant is not authenticated", 401));
    }

    const { orderId } = req.params;

    const orderFound = await Order.findById(orderId);

    if (!orderFound) {
      return next(appError("Order not found", 404));
    }
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = { getAllOrdersOfMerchantController, confirmOrderController };
