const mongoose = require("mongoose");
const AccountLogs = require("../../../models/AccountLogs");
const Customer = require("../../../models/Customer");
const Order = require("../../../models/Order");
const appError = require("../../../utils/appError");
const { formatDate, formatTime } = require("../../../utils/formatters");

const getAllCustomersController = async (req, res, next) => {
  try {
    const allCustomers = await Customer.find().select(
      "fullName email phoneNumber lastPlatformUsed createdAt customerDetails averageRating"
    );

    // Calculate averageRating and format registrationDate for each customer
    const formattedCustomers = allCustomers?.map((customer) => {
      return {
        _id: customer._id,
        fullName: customer.fullName || "N/A",
        email: customer.email || "N/A",
        phoneNumber: customer.phoneNumber || "N/A",
        lastPlatformUsed: customer.lastPlatformUsed || "N/A",
        registrationDate: formatDate(customer.createdAt),
        rating: customer.customerDetails.averageRating || 0,
      };
    });

    res.status(200).json({
      message: "All customers",
      data: formattedCustomers || [],
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const searchCustomerByNameController = async (req, res, next) => {
  try {
    const { query } = req.query;

    if (!query || query.trim() === "") {
      return res.status(400).json({
        message: "Search query cannot be empty",
      });
    }

    const searchResults = await Customer.find({
      fullName: { $regex: query.trim(), $options: "i" },
    })
      .select(
        "fullName email phoneNumber lastPlatformUsed createdAt customerDetails"
      )
      .lean({ virtuals: true });

    // Calculate averageRating and format registrationDate for each customer
    const formattedCustomers = searchResults.map((customer) => {
      return {
        _id: customer._id,
        fullName: customer.fullName || "N/A",
        email: customer.email || "N/A",
        phoneNumber: customer.phoneNumber,
        lastPlatformUsed: customer.lastPlatformUsed,
        registrationDate: formatDate(customer.createdAt),
        averageRating: customer.customerDetails?.averageRating || 0,
      };
    });

    res.status(200).json({
      message: "Searched customers",
      data: formattedCustomers,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const filterCustomerByGeofenceController = async (req, res, next) => {
  try {
    const { filter } = req.query;

    if (!filter) {
      return res.status(400).json({ message: "Geofence is required" });
    }

    // Convert geofence query parameter to ObjectId
    const geofenceObjectId = new mongoose.Types.ObjectId(filter.trim());

    const filteredResults = await Customer.find({
      "customerDetails.geofenceId": geofenceObjectId,
    })
      .select(
        "fullName email phoneNumber lastPlatformUsed createdAt customerDetails"
      )
      .lean({ virtuals: true });

    // Calculate averageRating and format registrationDate for each customer
    const formattedCustomers = filteredResults.map((customer) => {
      return {
        _id: customer._id,
        fullName: customer.fullName || "N/A",
        email: customer.email || "N/A",
        phoneNumber: customer.phoneNumber,
        lastPlatformUsed: customer.lastPlatformUsed,
        registrationDate: formatDate(customer.createdAt),
        averageRating: customer.customerDetails?.averageRating || 0,
      };
    });

    res.status(200).json({
      message: "Searched customers",
      data: formattedCustomers,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getSingleCustomerController = async (req, res, next) => {
  try {
    const { customerId } = req.params;

    const customerFound = await Customer.findById(customerId)
      .select(
        "fullName email phoneNumber lastPlatformUsed createdAt customerDetails walletTransactionDetail"
      )
      .lean({ virtuals: true });

    if (!customerFound) {
      return next(appError("Customer not found", 404));
    }

    const ordersOfCustomer = await Order.find({ customerId }).populate({
      path: "merchantId",
      select: "merchantDetail",
    });

    const formattedCustomerOrders = ordersOfCustomer?.map((order) => {
      const merchantDetail = order?.merchantId?.merchantDetail;
      const deliveryTimeMinutes = merchantDetail
        ? parseInt(merchantDetail?.deliveryTime, 10)
        : 0;
      const orderDeliveryTime = new Date(order.createdAt);
      orderDeliveryTime.setMinutes(
        orderDeliveryTime.getMinutes() + deliveryTimeMinutes
      );
      return {
        orderId: order._id,
        orderStatus: order.status,
        merchantName: order?.merchantId?.merchantDetail?.merchantName,
        deliveryMode: order?.orderDetail?.deliveryMode,
        orderTime: `${formatDate(order.createdAt)} | ${formatTime(
          order.createdAt
        )}`,
        deliveryTime: `${formatDate(order.createdAt)} | ${formatTime(
          orderDeliveryTime
        )}`,
        paymentMethod: order.paymentMode,
        deliveryOption: order.orderDetail.deliveryOption,
        amount: order.billDetail.grandTotal,
        paymentStatus: order.paymentStatus,
      };
    });

    const formattedcustomerTransactions =
      customerFound?.walletTransactionDetail?.map((transaction) => {
        return {
          closingBalance: transaction.closingBalance || 0,
          transactionAmount: transaction.transactionAmount || 0,
          transactionId: transaction.transactionId || "N/A",
          orderId: transaction.orderId || "N/A",
          date:
            `${formatDate(transaction.date)} | ${formatTime(
              transaction.date
            )}` || "N/A",
        };
      });

    const formattedCustomer = {
      _id: customerFound._id,
      fullName: customerFound.fullName || "N/A",
      email: customerFound.email || "N/A",
      phoneNumber: customerFound.phoneNumber,
      lastPlatformUsed: customerFound.lastPlatformUsed,
      registrationDate: formatDate(customerFound.createdAt),
      walletBalance: customerFound.customerDetails.walletBalance,
      homeAddress: customerFound.customerDetails?.homeAddress || "N/A",
      workAddress: customerFound.customerDetails?.workAddress || "N/A",
      otherAddress: customerFound.customerDetails?.otherAddress || "N/A",
      walletDetails: formattedcustomerTransactions || [],
      orderDetails: formattedCustomerOrders || [],
    };

    res.status(200).json({
      message: "Customer details",
      data: formattedCustomer,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const blockCustomerController = async (req, res, next) => {
  const { reason } = req.body;
  try {
    const customerFound = await Customer.findById(req.params.customerId);

    if (!customerFound) {
      return next(appError("Customer not found", 404));
    }

    console.log("Customer", customerFound);

    customerFound.isBlocked = true;
    customerFound.reasonForBlockingOrDeleting = reason;
    customerFound.blockedDate = new Date();

    let accountLogs = await AccountLogs.findOne({
      userId: customerFound._id,
    });

    if (!accountLogs) {
      accountLogs = await AccountLogs.create({
        userId: customerFound._id,
        fullName: customerFound.fullName,
        role: customerFound.role,
        description: reason,
      });
    } else {
      return res.status(500).json({ message: "User is already blocked" });
    }

    await accountLogs.save();
    await customerFound.save();

    res.status(200).json({ message: "Customer blocked successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

const editCustomerDetailsController = async (req, res, next) => {
  const {
    fullName,
    email,
    phoneNumber,
    homeAddress,
    workAddress,
    otherAddress,
  } = req.body;

  try {
    const customerFound = await Customer.findById(req.params.customerId);

    if (!customerFound) {
      return next(appError("Customer not found", 404));
    }

    const updatedFields = {
      fullName,
      email,
      phoneNumber,
      customerDetails: {
        homeAddress,
        workAddress,
        otherAddress,
      },
    };

    await Customer.findByIdAndUpdate(
      req.params.customerId,
      {
        $set: updatedFields,
      },
      { new: true }
    );

    res.status(200).json({ message: "Customer updated successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAllRatingsAndReviewsByAgentController = async (req, res, next) => {
  try {
    const { customerId } = req.params;

    const customerFound = await Customer.findById(customerId).populate({
      path: "customerDetails.ratingsByAgents",
      populate: {
        path: "agentId",
        model: "Agent",
        select: "fullName _id", // Selecting the fields of fullName and _id from Agent
      },
    });

    if (!customerFound) {
      next(appError("Customer not found", 404));
    }

    const ratingsOfCustomer =
      customerFound.customerDetails?.ratingsByAgents?.reverse();

    const ratings = ratingsOfCustomer?.map((rating) => ({
      review: rating.review,
      rating: rating.rating,
      agentId: {
        id: rating.agentId._id,
        fullName: rating.agentId.fullName,
      },
    }));

    res.status(200).json({
      message: "Ratings of customer by agent",
      data: ratings,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const addMoneyToWalletController = async (req, res, next) => {
  try {
    const { amount } = req.body;
    const { customerId } = req.params;

    const customerFound = await Customer.findById(customerId);

    if (!customerFound) {
      return next(appError("Customer not found", 404));
    }

    customerFound.customerDetails.walletBalance += amount;
    await customerFound.save();

    res
      .status(200)
      .json({ message: `${amount} Rs is added to customer's wallet` });
  } catch (err) {
    next(appError(err.message));
  }
};

const deductMoneyFromWalletCOntroller = async (req, res, next) => {
  try {
    const { amount } = req.body;
    const { customerId } = req.params;

    const customerFound = await Customer.findById(customerId);

    if (!customerFound) {
      return next(appError("Customer not found", 404));
    }

    customerFound.customerDetails.walletBalance -= amount;
    await customerFound.save();

    res
      .status(200)
      .json({ message: `${amount} Rs is deducted from customer's wallet` });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  getAllCustomersController,
  searchCustomerByNameController,
  filterCustomerByGeofenceController,
  getSingleCustomerController,
  blockCustomerController,
  editCustomerDetailsController,
  getAllRatingsAndReviewsByAgentController,
  addMoneyToWalletController,
  deductMoneyFromWalletCOntroller,
};
