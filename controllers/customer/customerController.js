const { validationResult } = require("express-validator");
const crypto = require("crypto");
const os = require("os");
const mongoose = require("mongoose");

const Customer = require("../../models/Customer");
const PromoCode = require("../../models/PromoCode");
const Order = require("../../models/Order");
const Agent = require("../../models/Agent");
const CustomerSubscription = require("../../models/CustomerSubscription");
const CustomerAppCustomization = require("../../models/CustomerAppCustomization");
const PickAndDropBanner = require("../../models/PickAndDropBanner");
const CustomOrderBanner = require("../../models/CustomOrderBanner");
const ServiceCategory = require("../../models/ServiceCategory");
const ReferralCode = require("../../models/ReferralCode");
const NotificationSetting = require("../../models/NotificationSetting");
const CustomerNotificationLogs = require("../../models/CustomerNotificationLog");
const AppBanner = require("../../models/AppBanner");
const CustomerCart = require("../../models/CustomerCart");
const Geofence = require("../../models/Geofence");
const Referral = require("../../models/Referral");
const ScheduledOrder = require("../../models/ScheduledOrder");
const scheduledPickAndCustom = require("../../models/ScheduledPickAndCustom");

const appError = require("../../utils/appError");
const generateToken = require("../../utils/generateToken");
const geoLocation = require("../../utils/getGeoLocation");
const {
  deleteFromFirebase,
  uploadToFirebase,
} = require("../../utils/imageOperation");
const {
  completeReferralDetail,
  calculateScheduledCartValue,
  calculatePromoCodeDiscount,
  deductPromoCodeDiscount,
} = require("../../utils/customerAppHelpers");
const {
  createRazorpayOrderId,
  verifyPayment,
} = require("../../utils/razorpayPayment");
const { formatDate, formatTime } = require("../../utils/formatters");

const { sendNotification, sendSocketData } = require("../../socket/socket");
const LoyaltyPoint = require("../../models/LoyaltyPoint");
const Banner = require("../../models/Banner");
const PickAndCustomCart = require("../../models/PickAndCustomCart");

// Register or login customer
const registerAndLoginController = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().reduce((acc, error) => {
      acc[error.path] = error.msg;
      return acc;
    }, {});
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const { phoneNumber, latitude, longitude, referralCode } = req.body;
    const location = [latitude, longitude];
    const geofence = await geoLocation(latitude, longitude, next);

    if (!geofence) {
      return res.status(400).json({
        message: "Location is outside the listed geofence",
      });
    }

    // Check if customer exists; if not, create a new one
    let customer = await Customer.findOne({ phoneNumber });

    const isNewCustomer = !customer;
    if (!customer) {
      customer = new Customer({
        phoneNumber,
        lastPlatformUsed: os.platform(),
        customerDetails: {
          location,
          geofenceId: geofence._id,
        },
      });
      await customer.save();
    } else {
      customer.lastPlatformUsed = os.platform();

      customer.customerDetails = {
        ...customer.customerDetails,
        location,
        geofenceId: geofence._id,
      };
      await customer.save();
    }

    if (customer.customerDetails.isBlocked) {
      return res.status(403).json({ message: "Account is Blocked" });
    }

    if (isNewCustomer) {
      if (referralCode) await completeReferralDetail(customer, referralCode);

      const notification = await NotificationSetting.findOne({
        event: "newCustomer",
      });
      if (notification) {
        const eventData = {
          title: notification.title,
          description: notification.description,
        };
        sendNotification(
          process.env.ADMIN_ID,
          "newCustomer",
          eventData,
          "Customer"
        );
        sendSocketData(process.env.ADMIN_ID, "newCustomer", eventData);
      }
    }

    res.status(isNewCustomer ? 201 : 200).json({
      success: `User ${isNewCustomer ? "created" : "logged in"} successfully`,
      id: customer.id,
      token: generateToken(customer.id, customer.role),
      role: customer.role,
      geofenceName: geofence.name,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get all geofences
const getAvailableGeofences = async (req, res, next) => {
  try {
    const availableGeofences = await Geofence.find({});

    const formattedResponse = availableGeofences?.map((geofence) => ({
      id: geofence._id,
      name: geofence.name,
    }));

    res.status(200).json({
      message: "Geofence name",
      data: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Set selected geofence
const setSelectedGeofence = async (req, res, next) => {
  try {
    const { geofenceId } = req.body;

    const [geofenceFound, customerFound] = await Promise.all([
      Geofence.findById(geofenceId),
      Customer.findById(req.userAuth),
    ]);

    if (!geofenceFound) return next(appError("Geofence not found", 404));
    if (!customerFound) return next(appError("Customer not found", 404));

    customerFound.customerDetails.geofenceId = geofenceId;

    await customerFound.save();

    res.status(200).json({ message: "Geofence saved successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get the profile details of customer
const getCustomerProfileController = async (req, res, next) => {
  try {
    const currentCustomer = await Customer.findById(req.userAuth).select(
      "fullName phoneNumber email customerDetails.customerImageURL customerDetails.walletBalance customerDetails.pricing"
    );

    if (!currentCustomer) return next(appError("Customer not found", 404));

    const formattedCustomer = {
      id: currentCustomer._id,
      fullName: currentCustomer.fullName || "-",
      imageURL: currentCustomer?.customerDetails?.customerImageURL || null,
      email: currentCustomer.email || "-",
      phoneNumber: currentCustomer.phoneNumber,
      walletBalance: currentCustomer?.customerDetails?.walletBalance || 0.0,
      haveSubscription:
        currentCustomer?.customerDetails?.pricing?.length > 0 ? true : false,
    };

    res.status(200).json({
      message: "Customer profile",
      data: formattedCustomer,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Update profile details of customer
const updateCustomerProfileController = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().reduce((acc, error) => {
      acc[error.path] = error.msg;
      return acc;
    }, {});
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const { fullName, email } = req.body;
    const normalizedEmail = email ? email.toLowerCase() : null;

    const currentCustomer = await Customer.findById(req.userAuth);

    if (!currentCustomer) return next(appError("Customer not found", 404));

    // Check if the new email is already in use by another user, only if email is provided
    if (normalizedEmail && normalizedEmail !== currentCustomer.email) {
      const emailExists = await Customer.exists({
        _id: { $ne: req.userAuth },
        email: normalizedEmail,
      });
      if (emailExists) {
        return res.status(409).json({
          errors: { email: "Email already exists" },
        });
      }
    }

    // Handle image update if provided
    let customerImageURL =
      currentCustomer?.customerDetails?.customerImageURL || "";

    if (req.file) {
      try {
        if (customerImageURL) await deleteFromFirebase(customerImageURL);
        customerImageURL = await uploadToFirebase(req.file, "CustomerImages");
      } catch (err) {
        return next(appError(err, 500));
      }
    }

    // Update customer details
    currentCustomer.fullName = fullName;
    currentCustomer.customerDetails.customerImageURL = customerImageURL;
    if (normalizedEmail) currentCustomer.email = normalizedEmail;

    await currentCustomer.save();

    res.status(200).json({ message: "Customer updated successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

// Update customer address details
const updateCustomerAddressController = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors
      .array()
      .map((error) => ({ [error.path]: error.msg }));
    return res.status(400).json({ errors: formattedErrors });
  }

  try {
    const { addresses } = req.body;

    const currentCustomer = await Customer.findById(req.userAuth);
    if (!currentCustomer) return next(appError("Customer not found", 404));

    // Initialize other addresses if not present
    const updatedOtherAddresses =
      currentCustomer.customerDetails.otherAddress || [];

    addresses.forEach((address) => {
      const {
        id,
        type,
        fullName,
        phoneNumber,
        flat,
        area,
        landmark,
        coordinates,
      } = address;
      const updatedAddress = {
        fullName,
        phoneNumber,
        flat,
        area,
        landmark,
        coordinates,
      };

      switch (type) {
        case "home":
          currentCustomer.customerDetails.homeAddress = updatedAddress;
          break;
        case "work":
          currentCustomer.customerDetails.workAddress = updatedAddress;
          break;
        case "other":
          if (id) {
            // Update existing other address if ID matches
            const index = updatedOtherAddresses.findIndex(
              (addr) => addr.id.toString() === id.toString()
            );
            if (index !== -1) {
              updatedOtherAddresses[index] = { id, ...updatedAddress };
            } else {
              updatedOtherAddresses.push({ id, ...updatedAddress });
            }
          } else {
            // Add new address with generated ID
            updatedOtherAddresses.push({
              id: new mongoose.Types.ObjectId(),
              ...updatedAddress,
            });
          }
          break;
        default:
          throw new Error("Invalid address type");
      }
    });

    // Replace other addresses with updated array
    currentCustomer.customerDetails.otherAddress = updatedOtherAddresses;
    await currentCustomer.save();

    res.status(200).json({
      message: "Customer addresses updated successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get the address details of customer
const getCustomerAddressController = async (req, res, next) => {
  try {
    const currentCustomer = await Customer.findById(req.userAuth);

    if (!currentCustomer) return next(appError("Customer not found", 404));

    const { homeAddress, workAddress, otherAddress } =
      currentCustomer.customerDetails;

    res.status(200).json({
      homeAddress,
      workAddress,
      otherAddress,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Adding money to wallet
const addWalletBalanceController = async (req, res, next) => {
  try {
    const { amount } = req.body;

    const { success, orderId } = await createRazorpayOrderId(amount);

    if (!success)
      return next(appError("Error in creating Razorpay order", 500));

    res.status(200).json({ success: true, orderId, amount });
  } catch (err) {
    next(appError(err.message));
  }
};

// Verifying adding money to wallet
const verifyWalletRechargeController = async (req, res, next) => {
  try {
    const { paymentDetails, amount } = req.body;
    const customerId = req.userAuth;

    const customer = await Customer.findById(customerId);
    if (!customer) return next(appError("Customer not found", 404));

    const parsedAmount = parseFloat(amount);

    const isPaymentValid = await verifyPayment(paymentDetails);
    if (!isPaymentValid) return next(appError("Invalid payment", 400));

    let walletTransaction = {
      closingBalance: customer?.customerDetails?.walletBalance || 0,
      transactionAmount: parsedAmount,
      transactionId: paymentDetails.razorpay_payment_id,
      date: new Date(),
      type: "Credit",
    };

    let customerTransaction = {
      madeOn: new Date(),
      transactionType: "Top-up",
      transactionAmount: parsedAmount,
      type: "Credit",
    };

    // Ensure walletBalance is initialized
    customer.customerDetails.walletBalance =
      parseFloat(customer?.customerDetails?.walletBalance) || 0;
    customer.customerDetails.walletBalance += parsedAmount;

    customer.walletTransactionDetail.push(walletTransaction);

    customer.transactionDetail.push(customerTransaction);

    await customer.save();

    res.status(200).json({ message: "Wallet recharged successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

// Rate agent with Order
const rateDeliveryAgentController = async (req, res, next) => {
  try {
    const currentCustomer = req.userAuth;

    const { orderId } = req.params;

    const { rating, review } = req.body;

    const orderFound = await Order.findById(orderId);

    if (!orderFound) return next(appError("Order not found", 404));

    const agentFound = await Agent.findById(orderFound.agentId);

    if (!agentFound) return next(appError("Agent not found", 404));

    let updatedRating = {
      review,
      rating,
    };

    // Initialize orderRating if it doesn't exist
    if (!orderFound.orderRating) orderFound.orderRating = {};

    orderFound.orderRating.ratingToDeliveryAgent = updatedRating;

    let updatedAgentRating = {
      customerId: currentCustomer,
      review,
      rating,
    };

    agentFound.ratingsByCustomers.push(updatedAgentRating);

    await Promise.all([orderFound.save(), agentFound.save()]);

    res.status(200).json({ message: "Agent rated successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get favorite merchants
const getFavoriteMerchantsController = async (req, res, next) => {
  try {
    const currentCustomer = req.userAuth;

    // Retrieving only necessary fields for customer and their favorite merchants
    const customer = await Customer.findById(currentCustomer)
      .select("customerDetails.favoriteMerchants")
      .populate({
        path: "customerDetails.favoriteMerchants",
        select:
          "merchantDetail.merchantName merchantDetail.deliveryTime merchantDetail.description merchantDetail.displayAddress merchantDetail.averageRating status merchantDetail.merchantFoodType merchantDetail.merchantImageURL merchantDetail.preOrderStatus",
      });

    if (!customer || !customer.customerDetails) {
      return next(appError("Customer details not found", 404));
    }

    // Map the favorite merchants into the desired format
    const formattedMerchants = customer.customerDetails.favoriteMerchants.map(
      (merchant) => ({
        id: merchant._id,
        merchantName: merchant?.merchantDetail?.merchantName || null,
        description: merchant?.merchantDetail?.description || null,
        averageRating: merchant?.merchantDetail?.averageRating,
        status: merchant?.status,
        restaurantType: merchant?.merchantDetail?.merchantFoodType || null,
        merchantImageURL:
          merchant?.merchantDetail?.merchantImageURL ||
          "https://firebasestorage.googleapis.com/v0/b/famto-aa73e.appspot.com/o/DefaultImages%2FMerchantDefaultImage.png?alt=media&token=a7a11e18-047c-43d9-89e3-8e35d0a4e231",
        displayAddress: merchant?.merchantDetail?.displayAddress || null,
        preOrderStatus: merchant?.merchantDetail?.preOrderStatus,
        isFavorite: true,
      })
    );

    res.status(200).json({
      message: "Favorite merchants retrieved successfully",
      data: formattedMerchants,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get favorite products
const getFavoriteProductsController = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.userAuth)
      .populate({
        path: "customerDetails.favoriteProducts",
        select: "productName price productImageURL categoryId inventory",
        populate: {
          path: "categoryId",
          select: "businessCategoryId merchantId",
        },
      })
      .select("customerDetails.favoriteProducts");

    if (!customer) return next(appError("Customer not found", 404));

    const formattedResponse = customer.customerDetails.favoriteProducts?.map(
      (product) => ({
        productId: product._id,
        productName: product.productName || null,
        price: product.price || null,
        productImageURL: product.productImageURL || null,
        businessCategoryId: product.categoryId.businessCategoryId || null,
        merchantId: product.categoryId.merchantId || null,
        inventory: product.inventory || null,
        description: product.description || null,
        isFavorite: true,
      })
    );

    res.status(200).json(formattedResponse);
  } catch (err) {
    next(appError(err.message));
  }
};

// Get all orders of customer in latest order
const getCustomerOrdersController = async (req, res, next) => {
  try {
    const currentCustomer = req.userAuth;

    // Query with only necessary fields and populate merchant details selectively
    const ordersOfCustomer = await Order.find({
      customerId: currentCustomer,
      status: { $in: ["Completed", "Cancelled"] },
    })
      .sort({ createdAt: -1 })
      .select("merchantId status createdAt billDetail orderDetail")
      .populate({
        path: "merchantId",
        select: "merchantDetail.merchantName merchantDetail.displayAddress",
      })
      .lean();

    const formattedResponse = ordersOfCustomer.map((order) => {
      return {
        orderId: order._id,
        merchantName: order?.merchantId?.merchantDetail?.merchantName || null,
        displayAddress:
          order?.merchantId?.merchantDetail?.displayAddress ||
          order?.orderDetail?.pickupAddress?.area ||
          null,
        deliveryMode: order?.orderDetail?.deliveryMode || null,
        orderStatus: order.status,
        orderDate: formatDate(order.createdAt),
        orderTime: formatTime(order.createdAt),
        grandTotal: order?.billDetail?.grandTotal || null,
      };
    });

    res.status(200).json({
      data: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message || "Server Error"));
  }
};

// Get all scheduled orders of customer
const getAllScheduledOrdersOfCustomer = async (req, res, next) => {
  try {
    const customerId = req.userAuth;

    const [universalOrders, pickAndCustomOrders] = await Promise.all([
      ScheduledOrder.find({ customerId }).populate(
        "merchantId",
        "merchantDetail.merchantName merchantDetail.displayAddress"
      ),
      scheduledPickAndCustom.find({ customerId }),
    ]);

    const allOrders = [...universalOrders, ...pickAndCustomOrders].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    const formattedResponse = allOrders?.map((order) => ({
      orderId: order._id,
      merchantName: order?.merchantId?.merchantDetail?.merchantName || null,
      displayAddress: order?.merchantId?.merchantDetail?.displayAddress || null,
      deliveryMode: order.orderDetail.deliveryMode || null,
      startDate: formatDate(order?.startDate),
      endDate: formatDate(order?.endDate),
      time: formatTime(order.time) || null,
      numberOfDays: order?.orderDetail?.numOfDays || null,
      grandTotal: order.billDetail.grandTotal || null,
    }));

    res.status(200).json({ data: formattedResponse });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get single order detail
const getSingleOrderDetailController = async (req, res, next) => {
  try {
    const currentCustomer = req.userAuth;
    const { orderId } = req.params;

    const orderFound = await Order.findOne({
      _id: orderId,
      customerId: currentCustomer,
    })
      .populate({
        path: "merchantId",
        select: "phoneNumber merchantDetail",
      })

      .exec();

    if (!orderFound) return next(appError("Order not found", 404));

    const formattedResponse = {
      orderId: orderFound?._id,
      pickUpAddress: orderFound?.orderDetail?.pickupAddress || null,
      deliveryAddress: orderFound?.orderDetail?.deliveryAddress || null,
      items: orderFound?.items || null,
      billDetail: {
        deliveryCharge: orderFound?.billDetail?.deliveryCharge || null,
        taxAmount: orderFound?.billDetail?.taxAmount || null,
        discountedAmount: orderFound?.billDetail?.discountedAmount || null,
        grandTotal: orderFound?.billDetail?.grandTotal || null,
        itemTotal: orderFound?.billDetail?.itemTotal || null,
        addedTip: orderFound?.billDetail?.addedTip || null,
        subTotal: orderFound?.billDetail?.subTotal || null,
        surgePrice: orderFound?.billDetail?.surgePrice || null,
        waitingCharge: orderFound?.billDetail?.waitingCharge || null,
        vehicleType: orderFound?.billDetail?.vehicleType || null,
      },
      orderDate: formatDate(orderFound?.createdAt),
      orderTime: formatTime(orderFound?.createdAt),
      paymentMode: orderFound?.paymentMode || null,
      deliveryMode: orderFound?.orderDetail?.deliveryMode || null,
      vehicleType: orderFound?.billDetail?.vehicleType || null,
    };

    res.status(200).json({
      message: "Single order detail",
      data: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get scheduled order detail
const getScheduledOrderDetailController = async (req, res, next) => {
  try {
    const { orderId, deliveryMode } = req.query;

    let orderFound;

    if (["Take Away", "Home Delivery"].includes(deliveryMode)) {
      orderFound = await ScheduledOrder.findById(orderId);
    } else if (["Pick and Drop", "Custom Order"].includes(deliveryMode)) {
      orderFound = await scheduledPickAndCustom.findById(orderId);
    }

    if (!orderFound) return next(appError("Order not found", 404));

    const formattedResponse = {
      orderId: orderFound._id,
      pickUpAddress: orderFound?.orderDetail?.pickupAddress || null,
      deliveryAddress: orderFound?.orderDetail?.deliveryAddress || null,
      items: orderFound?.items || null,
      billDetail: {
        deliveryCharge: orderFound?.billDetail?.deliveryCharge || null,
        taxAmount: orderFound?.billDetail?.taxAmount || null,
        discountedAmount: orderFound?.billDetail?.discountedAmount || null,
        grandTotal: orderFound?.billDetail?.grandTotal || null,
        itemTotal: orderFound?.billDetail?.itemTotal || null,
        addedTip: orderFound?.billDetail?.addedTip || null,
        subTotal: orderFound?.billDetail?.subTotal || null,
        surgePrice: orderFound?.billDetail?.surgePrice || null,
        waitingCharge: orderFound?.billDetail?.waitingCharge || null,
        vehicleType: orderFound?.billDetail?.vehicleType || null,
      },
      orderDate: formatDate(orderFound?.createdAt),
      orderTime: formatTime(orderFound?.createdAt),
      paymentMode: orderFound?.paymentMode || null,
      deliveryMode: orderFound?.orderDetail?.deliveryMode || null,
      vehicleType: orderFound?.billDetail?.vehicleType || null,
      startDate: formatDate(orderFound?.startDate),
      endDate: formatDate(orderFound?.endDate),
      time: formatTime(orderFound.time) || null,
      numberOfDays: orderFound?.orderDetail?.numOfDays || null,
    };

    res.status(200).json(formattedResponse);
  } catch (err) {
    next(appError(err.message));
  }
};

// Search order by dish or Merchant
const searchOrderController = async (req, res, next) => {
  try {
    const currentCustomer = req.userAuth;
    const { query } = req.query;

    if (!query) {
      return next(appError("Search query is required", 400));
    }

    // Use MongoDB to filter based on the query (case-insensitive regex search)
    const ordersOfCustomer = await Order.find({
      customerId: currentCustomer,
      $or: [
        {
          "merchantId.merchantDetail.merchantName": {
            $regex: query,
            $options: "i",
          },
        },
        { "items.itemName": { $regex: query, $options: "i" } },
        { "items.variantTypeName": { $regex: query, $options: "i" } },
      ],
    })
      .sort({ createdAt: -1 })
      .select("merchantId status createdAt items billDetail")
      .populate({
        path: "merchantId",
        select: "merchantDetail.merchantName merchantDetail.displayAddress",
      });

    // Format orders for the response
    const formattedResponse = ordersOfCustomer.map((order) => ({
      id: order._id,
      merchantName: order?.merchantId?.merchantDetail?.merchantName || null,
      displayAddress: order?.merchantId?.merchantDetail?.displayAddress || null,
      orderStatus: order?.status || null,
      orderDate: formatDate(order?.createdAt) || null,
      orderDate: formatTime(order?.createdAt) || null,
      items: order?.items || [],
      grandTotal: order?.billDetail?.grandTotal || null,
    }));

    res.status(200).json({
      message: "Search results for orders",
      data: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get transaction details of customer
const getTransactionOfCustomerController = async (req, res, next) => {
  try {
    const currentCustomer = req.userAuth;

    const customerFound = await Customer.findById(currentCustomer)
      .select("fullName customerDetails.customerImageURL transactionDetail")
      .exec();

    if (!customerFound) {
      return next(appError("Customer not found", 404));
    }

    const sortedTransactions = customerFound?.transactionDetail.sort(
      (a, b) => new Date(b.madeOn) - new Date(a.madeOn)
    );

    const formattedData = sortedTransactions.map((transaction) => {
      return {
        customerName: customerFound.fullName || "-",
        // TODO: Need to change the default image URL
        customerImage:
          customerFound.customerDetails.customerImageURL ||
          "https://firebasestorage.googleapis.com/v0/b/famto-aa73e.appspot.com/o/AgentImages%2Fdemo-image.png-0fe7a62e-6d1c-4e5f-9d3c-87698bdfc32e?alt=media&token=97737725-250d-481e-a8db-69bdaedbb073",
        transactionAmount: transaction.transactionAmount,
        transactionType: transaction.transactionType,
        type: transaction.type,
        transactionDate: `${formatDate(transaction.madeOn)}`,
        transactionTime: `${formatTime(transaction.madeOn)}`,
      };
    });

    res.status(200).json({
      message: "Customer transaction detail",
      data: formattedData,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get subscriptions details of customer
const getCustomerSubscriptionDetailController = async (req, res, next) => {
  try {
    const currentCustomer = req.userAuth;

    // Fetch both all subscription plans and the current customer subscription in one step
    const [allSubscriptionPlans, customer] = await Promise.all([
      CustomerSubscription.find().select(
        "title name amount duration taxId renewalReminder noOfOrder description"
      ),
      Customer.findById(currentCustomer)
        .select("customerDetails.pricing")
        .populate({
          path: "customerDetails.pricing",
          model: "SubscriptionLog",
          select: "planId endDate",
          populate: {
            path: "planId",
            model: "CustomerSubscription",
            select: "name duration amount description",
          },
        }),
    ]);

    // Format all available subscription plans
    const formattedAllSubscriptionPlans = allSubscriptionPlans.map((plan) => ({
      planId: plan._id,
      planName: plan.name,
      planAmount: plan.amount,
      planDuration: plan.duration,
      noOfOrder: plan.noOfOrder,
      description: plan.description,
    }));

    // Format the current subscription plan, if it exists
    const currentSubscription = customer.customerDetails.pricing[0];
    let formattedCurrentSubscriptionPlan = {};

    if (currentSubscription) {
      const { planId, endDate } = currentSubscription;
      const daysLeft = Math.ceil(
        (new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24)
      );

      formattedCurrentSubscriptionPlan = {
        planName: planId.name,
        planDuration: planId.duration,
        planAmount: planId.amount,
        daysLeft,
      };
    }

    res.status(200).json({
      currentSubscription: formattedCurrentSubscriptionPlan,
      allSubscriptionPlans: formattedAllSubscriptionPlans,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Fetch promo codes
const fetchPromoCodesController = async (req, res, next) => {
  try {
    const customerId = req.userAuth;
    const customer = await Customer.findById(customerId);

    if (!customer) return next(appError("Customer not found", 404));

    const { deliveryMode, query } = req.query;

    const currentDate = new Date();
    const filter = {
      geofenceId: customer.customerDetails.geofenceId,
      fromDate: { $lte: currentDate },
      toDate: { $gte: currentDate },
      $expr: { $lt: ["$noOfUserUsed", "$maxAllowedUsers"] },
    };

    if (deliveryMode) {
      filter.deliveryMode = deliveryMode;
    }

    if (query) {
      filter.$or = [{ promoCode: query.trim() }, { applicationMode: "Hidden" }];
    } else {
      filter.applicationMode = "Public";
    }

    const promocodesFound = await PromoCode.find(filter);

    const formattedResponse = promocodesFound.map((promo) => ({
      id: promo._id,
      imageURL: promo.imageUrl,
      promoCode: promo.promoCode,
      discount: promo.discount,
      description: promo.description,
      promoType: promo.promoType,
      validUpTo: formatDate(promo.toDate),
      maxDiscountValue: promo.maxDiscountValue,
      minOrderAmount: promo.minOrderAmount,
      status: promo.status,
    }));

    res.status(200).json({
      status: "Available promocodes",
      data: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get wallet balance and Loyalty points of customer
const getWalletAndLoyaltyController = async (req, res, next) => {
  try {
    const currentCustomer = req.userAuth;

    const customerFound = await Customer.findById(currentCustomer).select(
      "customerDetails.walletBalance customerDetails.totalLoyaltyPointEarned"
    );

    const customerData = {
      walletBalance:
        customerFound?.customerDetails?.walletBalance?.toString() || "0",
      loyaltyPoints:
        customerFound?.customerDetails?.loyaltyPointLeftForRedemption?.toString() ||
        "0",
    };

    res.status(200).json({
      message: "Wallet balance and loyalty points of customer",
      data: customerData,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get customers cart
const getCustomerCartController = async (req, res, next) => {
  try {
    const currentCustomer = req.userAuth;

    const populatedCart = await CustomerCart.findOne({
      customerId: currentCustomer,
    })
      .populate({
        path: "items.productId",
        select: "productName productImageURL description variants",
      })
      .exec();

    let populatedCartWithVariantNames;
    if (populatedCart) {
      populatedCartWithVariantNames = populatedCart.toObject();
      populatedCartWithVariantNames.items =
        populatedCartWithVariantNames.items.map((item) => {
          const product = item.productId;
          let variantTypeName = null;
          let variantTypeData = null;
          if (item.variantTypeId && product.variants) {
            const variantType = product.variants
              .flatMap((variant) => variant.variantTypes)
              .find((type) => type._id.equals(item.variantTypeId));
            if (variantType) {
              variantTypeName = variantType.typeName;
              variantTypeData = {
                id: variantType._id,
                variantTypeName: variantTypeName,
              };
            }
          }
          return {
            ...item,
            productId: {
              id: product._id,
              productName: product.productName,
              description: product.description,
              productImageURL: product.productImageURL,
            },
            variantTypeId: variantTypeData,
          };
        });
    }

    res.status(200).json({
      message: "Customer cart found",
      data: {
        showCart:
          populatedCartWithVariantNames?.items?.length > 0 ? true : false,
        cartId: populatedCartWithVariantNames?._id || null,
        customerId: populatedCartWithVariantNames?.customerId || null,
        merchantId: populatedCartWithVariantNames?.merchantId || null,
        items: populatedCartWithVariantNames?.items || [],
        deliveryOption:
          populatedCartWithVariantNames?.cartDetail?.deliveryOption || null,
        itemLength: populatedCartWithVariantNames?.items?.length || 0,
      },
    });
  } catch (err) {
    next(appError(err.message));
  }
};

//
const getSplashScreenImageController = async (req, res, next) => {
  try {
    const splashScreenImage = await CustomerAppCustomization.findOne({}).select(
      "splashScreenUrl"
    );

    res.status(200).json({
      message: "Splash screen image",
      data: splashScreenImage.splashScreenUrl,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

//
const getCustomerAppBannerController = async (req, res, next) => {
  try {
    const allBanners = await AppBanner.find({ status: true }).select(
      "name imageUrl"
    );

    const formattedResponse = allBanners?.map((banner) => {
      return {
        name: banner.name,
        imageUrl: banner.imageUrl,
      };
    });

    res.status(200).json({ message: "Banner", data: formattedResponse });
  } catch (err) {
    next(appError(err.message));
  }
};

//
const getPickAndDropBannersController = async (req, res, next) => {
  try {
    const allBanners = await PickAndDropBanner.find({ status: true }).select(
      "title description imageUrl"
    );

    const formattedResponse = allBanners.map((banner) => {
      return {
        title: banner.title,
        description: banner.description,
        imageUrl: banner.imageUrl,
      };
    });

    res.status(200).json({ message: "Banner", data: formattedResponse });
  } catch (err) {
    next(appError(err.message));
  }
};

//
const getCustomOrderBannersController = async (req, res, next) => {
  try {
    const allBanners = await CustomOrderBanner.find({ status: true }).select(
      "title description imageUrl"
    );

    const formattedResponse = allBanners?.map((banner) => {
      return {
        title: banner.title,
        description: banner.description,
        imageUrl: banner.imageUrl,
      };
    });

    res.status(200).json({ message: "Banner", data: formattedResponse });
  } catch (err) {
    next(appError(err.message));
  }
};

//
const getMerchantAppBannerController = async (req, res, next) => {
  try {
    const { merchantId } = req.params;

    const banners = await Banner.find({ merchantId }).select("imageUrl");

    const formattedResponse = banners?.map((banner) => ({
      imageURL: banner.imageUrl,
    }));

    res.status(200).json(formattedResponse);
  } catch (err) {
    next(appError(err.message));
  }
};

//
const getAvailableServiceController = async (req, res, next) => {
  try {
    const availableServices = await ServiceCategory.find({})
      .select("title geofenceId bannerImageURL")
      .sort({ order: 1 });

    const formattedResponse = availableServices?.map((service) => {
      return {
        title: service.title,
        bannerImageURL: service.bannerImageURL,
      };
    });

    res.status(200).json({
      message: "All service categories",
      data: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

//
const generateReferralCode = async (req, res, next) => {
  try {
    const customerId = req.userAuth;

    // Find the customer and any existing referral code in one query
    const customer = await Customer.findById(customerId)
      .select("fullName email customerDetails.referralCode")
      .populate("customerDetails.referralCode");

    if (!customer) {
      return next(appError("Customer not found", 404));
    }

    // If a referral code already exists, return it
    if (customer.customerDetails.referralCode) {
      return res.status(200).json({
        message: "Referral Code",
        appLink: process.env.PLAY_STORE_APP_LINK,
        referralCode: customer.customerDetails.referralCode,
      });
    }

    // Generate a new referral code if one doesn't exist
    const newReferralCode = `${customerId.slice(1)}${crypto
      .randomBytes(2)
      .toString("hex")
      .toUpperCase()}`;

    await ReferralCode.create({
      customerId,
      name: customer.fullName,
      email: customer.email,
      referralCode: newReferralCode,
    });

    // Attach the referral code to the customer and save
    customer.customerDetails.referralCode = newReferralCode;
    await customer.save();

    res.status(200).json({
      message: "Referral Code",
      appLink: process.env.PLAY_STORE_APP_LINK,
      referralCode: newReferralCode,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

//
const getSelectedOngoingOrderDetailController = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const customerId = req.userAuth;

    const orderFound = await Order.findOne({
      _id: orderId,
      customerId,
    })
      .populate("agentId")
      .populate("merchantId")
      .select(
        "agentId merchantId orderDetail.deliveryTime orderDetail.pickupLocation orderDetail.deliveryLocation billDetail orderDetailStepper detailAddedByAgent paymentStatus"
      );

    const formattedResponse = {
      orderId: orderFound?._id,
      agentId: orderFound?.agentId?._id || null,
      agentName: orderFound?.agentId?.fullName || null,
      agentLocation: orderFound?.agentId?.location || null,
      agentImageURL: orderFound?.agentId?.agentImageURL || null,
      merchantName:
        orderFound?.merchantId?.merchantDetail?.merchantName || null,
      merchantPhone: orderFound?.merchantId?.phoneNumber || null,
      agentPhone: orderFound?.agentId?.phoneNumber || null,
      deliveryTime: formatTime(orderFound.orderDetail.deliveryTime),
      paymentStatus: orderFound?.paymentStatus || null,
      orderDetail: {
        pickupLocation: orderFound?.orderDetail?.pickupLocation || null,
        deliveryLocation: orderFound?.orderDetail?.deliveryLocation || null,
      },
      orderDetailStepper: orderFound?.orderDetailStepper || null,
      detailAddedByAgent: {
        notes: orderFound?.detailAddedByAgent.notes || null,
        signatureImageURL:
          orderFound?.detailAddedByAgent.signatureImageURL || null,
        imageURL: orderFound?.detailAddedByAgent.imageURL || null,
      },
      billDetail: orderFound?.billDetail || null,
    };

    res.status(200).json(formattedResponse);
  } catch (err) {
    next(appError(err.message));
  }
};

//
const getAllNotificationsOfCustomerController = async (req, res, next) => {
  try {
    const customerId = req.userAuth;

    const getAllNotifications = await CustomerNotificationLogs.find({
      customerId,
    }).sort({ createdAt: -1 });

    const formattedResponse = getAllNotifications?.map((notification) => {
      return {
        notificationId: notification._id,
        imageUrl: notification?.imageUrl || null,
        title: notification?.title || null,
        description: notification?.description || null,
      };
    });

    res.status(200).json({
      message: "All notifications",
      data: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

//
const getVisibilityOfReferralAndLoyaltyPoint = async (req, res, next) => {
  try {
    const { query } = req.query;

    let itemFound;

    if (query === "loyalty-point") {
      itemFound = await LoyaltyPoint.find({ status: true });
    } else if (query === "referral") {
      itemFound = await Referral.find({ status: true });
    }

    let status = itemFound.length >= 1 ? true : false;

    res.status(200).json({ status });
  } catch (err) {
    next(appError(err.message));
  }
};

//
const getCurrentOngoingOrders = async (req, res, next) => {
  try {
    const customerId = req.userAuth;

    const ordersFound = await Order.find({
      customerId,
      $or: [{ status: "Pending" }, { status: "On-going" }],
    })
      .select("orderDetail.deliveryTime")
      .sort({ createdAt: -1 });

    const formattedResponse = ordersFound?.map((order) => ({
      orderId: order._id,
      deliveryTime: formatTime(order?.orderDetail?.deliveryTime) || null,
    }));

    res.status(200).json(formattedResponse);
  } catch (err) {
    next(appError(err.message));
  }
};

const removeAppliedPromoCode = async (req, res, next) => {
  try {
    const { cartId, deliveryMode } = req.body;

    const modal =
      deliveryMode === "Take Away" || deliveryMode === "Home Delivery"
        ? CustomerCart
        : PickAndCustomCart;

    const cart = await modal.findById(cartId);

    if (!cart) return next(appError("Cart not found", 404));

    const { billDetail } = cart;
    const promoCodeFound = await PromoCode.findOne({
      promoCode: billDetail.promoCodeUsed,
    });

    if (!promoCodeFound) {
      return next(appError("Promo code not found", 404));
    }

    const { itemTotal, originalDeliveryCharge } = billDetail;

    const totalCartPrice =
      cart.cartDetail.deliveryOption === "Scheduled"
        ? calculateScheduledCartValue(cart, promoCodeFound)
        : deliveryMode === "Take Away" || deliveryMode === "Home Delivery"
        ? itemTotal
        : originalDeliveryCharge;

    const promoCodeDiscount = calculatePromoCodeDiscount(
      promoCodeFound,
      totalCartPrice
    );

    const updatedCart = deductPromoCodeDiscount(cart, promoCodeDiscount);

    res.status(200).json({
      success: "Promo code applied successfully",
      data: updatedCart.billDetail,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  registerAndLoginController,
  getAvailableGeofences,
  setSelectedGeofence,
  getCustomerProfileController,
  updateCustomerProfileController,
  updateCustomerAddressController,
  getCustomerAddressController,
  addWalletBalanceController,
  verifyWalletRechargeController,
  rateDeliveryAgentController,
  getFavoriteMerchantsController,
  getFavoriteProductsController,
  getCustomerOrdersController,
  getSingleOrderDetailController,
  getTransactionOfCustomerController,
  getCustomerSubscriptionDetailController,
  searchOrderController,
  getWalletAndLoyaltyController,
  getCustomerCartController,
  getCustomerAppBannerController,
  getSplashScreenImageController,
  getPickAndDropBannersController,
  getCustomOrderBannersController,
  getAvailableServiceController,
  generateReferralCode,
  getSelectedOngoingOrderDetailController,
  getAllNotificationsOfCustomerController,
  getVisibilityOfReferralAndLoyaltyPoint,
  getCurrentOngoingOrders,
  getAllScheduledOrdersOfCustomer,
  getScheduledOrderDetailController,
  getMerchantAppBannerController,
  fetchPromoCodesController,
  removeAppliedPromoCode,
};
