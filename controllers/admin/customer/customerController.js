const mongoose = require("mongoose");
const AccountLogs = require("../../../models/AccountLogs");
const Customer = require("../../../models/Customer");
const Order = require("../../../models/Order");
const appError = require("../../../utils/appError");
const { formatDate, formatTime } = require("../../../utils/formatters");

const getAllCustomersController = async (req, res, next) => {
  try {
    // Get page and limit from query parameters with default values
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const skip = (page - 1) * limit;

    // Fetch customers with pagination
    const allCustomers = await Customer.find()
      .select(
        "fullName email phoneNumber lastPlatformUsed createdAt customerDetails averageRating"
      )
      .skip(skip)
      .limit(limit);

    // Count total documents
    const totalDocuments = await Customer.countDocuments({});

    // Format customers data
    const formattedCustomers = allCustomers?.map((customer) => {
      return {
        _id: customer._id,
        fullName: customer.fullName || "-",
        email: customer.email || "-",
        phoneNumber: customer.phoneNumber || "-",
        lastPlatformUsed: customer.lastPlatformUsed || "-",
        registrationDate: formatDate(customer.createdAt),
        rating: customer?.customerDetails?.averageRating || 0,
      };
    });

    // Calculate total pages
    const totalPages = Math.ceil(totalDocuments / limit);

    res.status(200).json({
      message: "All customers",
      data: formattedCustomers || [],
      totalDocuments,
      totalPages,
      currentPage: page,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const searchCustomerByNameController = async (req, res, next) => {
  try {
    let { query, page = 1, limit = 25 } = req.query;

    if (!query || query.trim() === "") {
      return res.status(400).json({
        message: "Search query cannot be empty",
      });
    }

    // Convert to integers
    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    // Calculate the number of documents to skip
    const skip = (page - 1) * limit;

    const searchResults = await Customer.find({
      fullName: { $regex: query.trim(), $options: "i" },
    })
      .select(
        "fullName email phoneNumber lastPlatformUsed createdAt customerDetails"
      )
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: true });

    // Count total documents
    const totalDocuments = await Customer.countDocuments({});

    // Calculate averageRating and format registrationDate for each customer
    const formattedCustomers = searchResults.map((customer) => {
      const homeAddress = customer?.customerDetails?.homeAddress || {};
      const workAddress = customer?.customerDetails?.workAddress || {};
      const otherAddress = customer?.customerDetails?.otherAddress || [];

      return {
        _id: customer._id,
        fullName: customer.fullName || "-",
        email: customer.email || "-",
        phoneNumber: customer.phoneNumber,
        lastPlatformUsed: customer.lastPlatformUsed,
        registrationDate: formatDate(customer.createdAt),
        averageRating: customer.customerDetails?.averageRating || 0,
        address: [
          { type: "home", homeAddress },
          { type: "work", workAddress },
          { type: "other", otherAddress },
        ],
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
      message: "Searched customers",
      data: formattedCustomers,
      pagination,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const filterCustomerByGeofenceController = async (req, res, next) => {
  try {
    let { filter, page = 1, limit = 25 } = req.query;

    if (!filter) {
      return res.status(400).json({ message: "Geofence is required" });
    }

    // Convert to integers
    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    // Calculate the number of documents to skip
    const skip = (page - 1) * limit;

    // Convert geofence query parameter to ObjectId
    const geofenceObjectId = new mongoose.Types.ObjectId(filter.trim());

    const filteredResults = await Customer.find({
      "customerDetails.geofenceId": geofenceObjectId,
    })
      .select(
        "fullName email phoneNumber lastPlatformUsed createdAt customerDetails"
      )
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: true });

    // Count total documents
    const totalDocuments = await Customer.countDocuments({});

    // Calculate averageRating and format registrationDate for each customer
    const formattedCustomers = filteredResults.map((customer) => {
      return {
        _id: customer._id,
        fullName: customer.fullName || "-",
        email: customer.email || "-",
        phoneNumber: customer.phoneNumber,
        lastPlatformUsed: customer?.lastPlatformUsed || "-",
        registrationDate: formatDate(customer.createdAt),
        averageRating: customer.customerDetails?.averageRating || 0,
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
      message: "Searched customers",
      data: formattedCustomers,
      pagination,
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
          transactionId: transaction.transactionId || "-",
          orderId: transaction.orderId || "-",
          date:
            `${formatDate(transaction.date)} | ${formatTime(
              transaction.date
            )}` || "-",
        };
      });

    const formattedCustomer = {
      _id: customerFound._id,
      fullName: customerFound.fullName || "-",
      email: customerFound.email || "-",
      phoneNumber: customerFound.phoneNumber,
      lastPlatformUsed: customerFound.lastPlatformUsed,
      registrationDate: formatDate(customerFound.createdAt),
      walletBalance: customerFound.customerDetails.walletBalance,
      homeAddress: customerFound.customerDetails?.homeAddress || "-",
      workAddress: customerFound.customerDetails?.workAddress || "-",
      otherAddress: customerFound.customerDetails?.otherAddress || "-",
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

    if (isNaN(amount)) {
      return next(appError("Invalid amount provided", 400));
    }

    const customerFound = await Customer.findById(customerId);

    if (!customerFound) {
      return next(appError("Customer not found", 404));
    }

    // Ensure walletBalance is a number
    const currentBalance =
      Number(customerFound.customerDetails.walletBalance) || 0;
    const amountToAdd = Number(amount);

    customerFound.customerDetails.walletBalance = currentBalance + amountToAdd;
    await customerFound.save();

    res.status(200).json({
      message: `${amount} Rs is added to customer's wallet`,
    });
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

// ---------------------------------
// For Merchant
// ---------------------------------

const getCustomersOfMerchant = async (req, res, next) => {
  try {
    const merchantId = req.userAuth;

    // Fetch all orders of the merchant
    const ordersOfMerchant = await Order.find({ merchantId }).select(
      "customerId"
    );

    // Extract unique customer IDs
    const uniqueCustomerIds = [
      ...new Set(ordersOfMerchant.map((order) => order.customerId.toString())),
    ];

    // Fetch customer names for the unique customer IDs
    const customers = await Customer.find({
      _id: { $in: uniqueCustomerIds },
    }).select(
      "fullName phoneNumber email lastPlatformUsed createdAt averageRating"
    );

    const formattedResponse = customers?.map((customer) => {
      return {
        _id: customer._id,
        fullName: customer?.fullName || "-",
        phoneNumber: customer?.phoneNumber || "-",
        email: customer?.email || "-",
        lastPlatformUsed: customer.lastPlatformUsed,
        registrationDate: formatDate(customer.createdAt),
        rating: Math.floor(customer?.averageRating) || 0,
      };
    });

    res.status(200).json({
      message: "Customers of merchant",
      data: formattedResponse,
    });
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
  getCustomersOfMerchant,
};
