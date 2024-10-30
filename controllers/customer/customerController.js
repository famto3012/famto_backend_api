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

const appError = require("../../utils/appError");
const generateToken = require("../../utils/generateToken");
const geoLocation = require("../../utils/getGeoLocation");
const {
  deleteFromFirebase,
  uploadToFirebase,
} = require("../../utils/imageOperation");
const {
  getDistanceFromPickupToDelivery,
  completeReferralDetail,
} = require("../../utils/customerAppHelpers");
const {
  createRazorpayOrderId,
  verifyPayment,
} = require("../../utils/razorpayPayment");
const { formatDate, formatTime } = require("../../utils/formatters");
const { formatToHours } = require("../../utils/agentAppHelpers");

const { sendNotification, sendSocketData } = require("../../socket/socket");
const Geofence = require("../../models/Geofence");
const Referral = require("../../models/Referral");

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
      // Update the existing customer's details
      customer.lastPlatformUsed = os.platform();
      customer.customerDetails.location = location;
      customer.customerDetails.geofenceId = geofence._id;
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

    const geofenceFound = await Geofence.findById(geofenceId);

    if (!geofenceFound) return next(appError("Geofence not found", 404));

    const customerFound = await Customer.findById(req.userAuth);

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
      "fullName phoneNumber email customerDetails"
    );

    if (!currentCustomer) {
      return next(appError("Customer not found", 404));
    }

    const formattedCustomer = {
      id: currentCustomer._id,
      fullName: currentCustomer.fullName || "-",
      imageURL: currentCustomer?.customerDetails?.customerImageURL || null,
      email: currentCustomer.email || "-",
      phoneNumber: currentCustomer.phoneNumber,
      walletBalance: currentCustomer?.customerDetails?.walletBalance || 0.0,
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

  const { fullName, email } = req.body;
  const normalizedEmail = email ? email.toLowerCase() : null;

  try {
    const currentCustomer = await Customer.findById(req.userAuth);

    if (!currentCustomer) {
      return next(appError("Customer not found", 404));
    }

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
        return next(appError("Error uploading image", 500));
      }
    }

    // Update customer details
    currentCustomer.fullName = fullName;
    if (normalizedEmail) {
      currentCustomer.email = normalizedEmail;
    }
    currentCustomer.customerDetails.customerImageURL = customerImageURL;

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

  const { addresses } = req.body;

  try {
    const currentCustomer = await Customer.findById(req.userAuth);
    if (!currentCustomer) {
      return next(appError("Customer not found", 404));
    }

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

    if (!currentCustomer) {
      return next(appError("Customer not found", 404));
    }

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

    if (!success) {
      return next(appError("Error in creating Razorpay order", 500));
    }

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

    if (!customerId) {
      return next(appError("Customer is not authenticated", 200));
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return next(appError("Customer not found", 404));
    }

    const parsedAmount = parseFloat(amount);

    const isPaymentValid = await verifyPayment(paymentDetails);
    if (!isPaymentValid) {
      return next(appError("Invalid payment", 400));
    }

    let walletTransaction = {
      closingBalance: customer?.customerDetails?.walletBalance || 0,
      transactionAmount: parsedAmount,
      transactionId: paymentDetails.razorpay_payment_id,
      date: new Date(),
      type: "Credit",
    };

    let customerTransation = {
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

    customer.transactionDetail.push(customerTransation);

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

    if (!orderFound) {
      return next(appError("Order not found", 404));
    }

    const agentFound = await Agent.findById(orderFound.agentId);

    if (!agentFound) {
      return next(appError("Agent not found", 404));
    }

    let updatedRating = {
      review,
      rating,
    };

    // Initialize orderRating if it doesn't exist
    if (!orderFound.orderRating) {
      orderFound.orderRating = {};
    }

    orderFound.orderRating.ratingToDeliveryAgent = updatedRating;

    let updatedAgentRating = {
      customerId: currentCustomer,
      review,
      rating,
    };

    agentFound.ratingsByCustomers.push(updatedAgentRating);

    await orderFound.save();
    await agentFound.save();

    res.status(200).json({ message: "Agent rated successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get favourite merchants
const getFavoriteMerchantsController = async (req, res, next) => {
  try {
    const currentCustomer = req.userAuth;

    // Retrieving only necessary fields for customer and their favorite merchants
    const customer = await Customer.findById(currentCustomer)
      .select("customerDetails.favoriteMerchants")
      .populate({
        path: "customerDetails.favoriteMerchants",
        select:
          "merchantDetail.merchantName merchantDetail.deliveryTime merchantDetail.description merchantDetail.averageRating status merchantDetail.merchantFoodType merchantDetail.merchantImageURL",
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
        merchantImageURL: merchant?.merchantDetail?.merchantImageURL || null,
        displayAddress: merchant?.merchantDetail?.displayAddress || null,
        preOrderStatus: merchant?.merchantDetail?.preOrderStatus,
        isFavorite: true, // Since we're only fetching favorite merchants
      })
    );

    res.status(200).json({
      message: "Favourite merchants retrieved successfully",
      data: formattedMerchants,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get all orders of customer in latest order
const getCustomerOrdersController = async (req, res, next) => {
  try {
    const currentCustomer = req.userAuth;

    // Query with only necessary fields and populate merchant details selectively
    const ordersOfCustomer = await Order.find({ customerId: currentCustomer })
      .sort({ createdAt: -1 })
      .select("merchantId status createdAt items billDetail orderDetail")
      .populate({
        path: "merchantId",
        select: "merchantDetail.merchantName merchantDetail.displayAddress",
      });

    const formattedResponse = ordersOfCustomer.map((order) => {
      // Map order status to human-readable format
      const orderStatus =
        order.status === "Pending" || order.status === "Ongoing"
          ? "On-going"
          : order.status === "Cancelled"
          ? "Cancelled"
          : "Completed";

      return {
        id: order._id,
        merchantName: order?.merchantId?.merchantDetail?.merchantName || null,
        displayAddress:
          order?.merchantId?.merchantDetail?.displayAddress ||
          order?.orderDetail?.pickupAddress?.area ||
          null,
        deliveryMode: order?.orderDetail?.deliveryMode || null,
        orderStatus,
        orderDate: formatDate(order.createdAt),
        orderTime: formatTime(order.createdAt),
        items: order.items,
        grandTotal: order.billDetail.grandTotal,
      };
    });

    res.status(200).json({
      message: "Orders of customer",
      data: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get single order detail
const getsingleOrderDetailController = async (req, res, next) => {
  try {
    const currentCustomer = req.userAuth;

    const { orderId } = req.params;

    const singleOrderDetail = await Order.findOne({
      _id: orderId,
      customerId: currentCustomer,
    })
      .populate({
        path: "merchantId",
        select: "phoneNumber merchantDetail",
      })

      .exec();

    if (!singleOrderDetail) {
      return next(appError("Order not found", 404));
    }

    const formattedResponse = {
      id: singleOrderDetail?._id,
      merchantName:
        singleOrderDetail?.merchantId?.merchantDetail?.merchantName || null,
      displayAddress:
        singleOrderDetail?.merchantId?.merchantDetail?.displayAddress || null,
      deliveryTime:
        singleOrderDetail?.merchantId?.merchantDetail?.deliveryTime || null,
      distance: singleOrderDetail?.orderDetail?.distance || null,
      items: singleOrderDetail?.items || null,
      billDetail: singleOrderDetail?.billDetail || null,
      deliveryAddress: singleOrderDetail?.orderDetail?.deliveryAddress || null,
      orderDate: `${formatDate(singleOrderDetail?.createdAt)}` || null,
      orderTime: `${formatTime(singleOrderDetail?.createdAt)}` || null,
      paymentMode: singleOrderDetail?.paymentMode || null,
      // merchantPhone: singleOrderDetail?.merchantId?.phoneNumber || null,
      // fssaiNumber:
      //   singleOrderDetail?.merchantId?.merchantDetail?.FSSAINumber || null,
    };

    res.status(200).json({
      message: "Single order detail",
      data: formattedResponse,
    });
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

    const allSubscriptionPlans = await CustomerSubscription.find({});

    const formattedAllSubscriptionPlans = allSubscriptionPlans.map((plan) => {
      return {
        id: plan._id,
        title: plan.title,
        name: plan.name,
        amount: plan.amount,
        duration: plan.duration,
        taxId: plan.taxId,
        renewalReminder: plan.renewalReminder,
        noOfOrder: plan.noOfOrder,
        description: plan.description,
      };
    });

    const currentSubscriptionLog = await Customer.findById(currentCustomer)
      .select("customerDetails")
      .populate({
        path: "customerDetails.pricing",
        model: "SubscriptionLog",
      })
      .exec();

    let formattedCurrentSubscriptionPlan;

    if (
      currentSubscriptionLog &&
      currentSubscriptionLog.customerDetails.pricing &&
      currentSubscriptionLog.customerDetails.pricing.length
    ) {
      const currentSubscriptionPlanId =
        currentSubscriptionLog.customerDetails.pricing[0].planId;

      const currentSubscription = await CustomerSubscription.findById(
        currentSubscriptionPlanId
      );

      const endDate = currentSubscriptionLog.customerDetails.pricing[0].endDate;

      const currentDate = new Date();
      const endDateObject = new Date(endDate);

      const timeDiff = endDateObject - currentDate;
      const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

      formattedCurrentSubscriptionPlan = {
        planName: currentSubscription.name,
        duration: currentSubscription.duration,
        amount: currentSubscription.amount,
        description: currentSubscription.description,
        daysLeft,
      };
    }

    res.status(200).json({
      message: "Subscription plan details",
      data: {
        allSubscriptionPlans: formattedAllSubscriptionPlans,
        currentSubscription: formattedCurrentSubscriptionPlan || {},
      },
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get all promocodes by customer geofence
const getPromocodesOfCustomerController = async (req, res, next) => {
  try {
    const currentCustomer = req.userAuth;
    const customerFound = await Customer.findById(currentCustomer);

    if (!customerFound) {
      return next(appError("Customer not found", 404));
    }

    const currentDate = new Date();

    const promocodesFound = await PromoCode.find({
      status: true,
      geofenceId: customerFound.customerDetails.geofenceId,
      fromDate: { $lte: currentDate },
      applicationMode: "Public",
      toDate: { $gte: currentDate },
      $expr: { $lt: ["$noOfUserUsed", "$maxAllowedUsers"] },
    });

    const formattedResponse = promocodesFound.map((promo) => {
      return {
        id: promo._id,
        imageURL: promo.imageUrl,
        promoCode: promo.promoCode,
        validUpTo: formatDate(promo.toDate),
      };
    });

    res.status(200).json({
      status: "Available promocodes",
      data: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Search available promo codes
const searchPromocodeController = async (req, res, next) => {
  try {
    const currentCustomer = req.userAuth;

    const customerFound = await Customer.findById(currentCustomer);

    if (!customerFound) {
      return next(appError("Customer not found", 404));
    }

    const { query } = req.query;

    const currentDate = new Date();

    const promocodesFound = await PromoCode.find({
      promoCode: { $regex: query.trim(), $options: "i" },
      status: true,
      geofenceId: customerFound.customerDetails.geofenceId,
      fromDate: { $lte: currentDate },
      toDate: { $gte: currentDate },
      $expr: { $lt: ["$noOfUserUsed", "$maxAllowedUsers"] },
    });

    const formattedResponse = promocodesFound.map((promo) => {
      return {
        id: promo._id,
        imageURL: promo.imageUrl,
        promoCode: promo.promoCode,
        validUpTo: formatDate(promo.toDate),
      };
    });

    res.status(200).json({
      status: "Search results of promocode",
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
      walletBalance: customerFound.customerDetails?.walletBalance || 0,
      loyaltyPoints:
        customerFound.customerDetails?.totalLoyaltyPointEarned || 0,
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
        cartId: populatedCartWithVariantNames._id,
        customerId: populatedCartWithVariantNames.customerId,
        merchantId: populatedCartWithVariantNames?.merchantId || null,
        items: populatedCartWithVariantNames?.items || [],
      },
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getSpalshScreenImageController = async (req, res, next) => {
  try {
    const spalshScreenImage = await CustomerAppCustomization.findOne({}).select(
      "splashScreenUrl"
    );

    res.status(200).json({
      message: "Splash screen image",
      data: spalshScreenImage.splashScreenUrl,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

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

const generateReferralCode = async (req, res, next) => {
  try {
    const customerId = req.userAuth;

    const customerFound = await Customer.findById(customerId).select(
      "fullName email "
    );

    if (!customerFound) {
      return next(appError("Customer not found", 404));
    }

    const referralFound = await ReferralCode.findOne({ customerId });

    // App link
    const appLink = process.env.PLAY_STORE_APP_LINK;

    if (referralFound) {
      return res.status(200).json({
        message: "Referral Code",
        appLink,
        referralCode: referralFound.referralCode,
      });
    } else {
      // Extract digits from customerId
      const digits = customerId.replace(/\D/g, "");

      // Generate a secure random alphanumeric string of length 4
      const randomPart = crypto.randomBytes(2).toString("hex").toUpperCase();

      // Combine digits with the random part
      const referralCode = `${digits}${randomPart}`;

      const newReferral = await ReferralCode.create({
        customerId,
        name: customerFound?.fullName,
        email: customerFound?.email,
        referralCode,
      });

      if (!newReferral) {
        return next(appError("Error in creating referral code"));
      }

      customerFound.customerDetails.referralCode = referralCode;

      await customerFound.save();

      // Respond with the generated referral code
      return res.status(200).json({
        message: "Referral Code",
        appLink,
        referralCode,
      });
    }
  } catch (err) {
    next(appError(err.message));
  }
};

const getCurrentOrderDetailcontroller = async (req, res, next) => {
  try {
    const customerId = req.userAuth;

    const orderFound = await Order.findOne({
      customerId,
      status: "On-going",
    })
      .populate("agentId")
      .populate("merchantId");

    const timeDiff =
      new Date(orderFound.orderDetail.deliveryTime) -
      new Date(orderFound.createdAt);

    const formattedResponse = {
      orderId: orderFound._id,
      agentId: orderFound.agentId._id,
      agentName: orderFound.agentId.fullName,
      agentLocation: orderFound.agentId.location,
      agentImageURL: orderFound.agentId.agentImageURL,
      agentPhone: orderFound.agentId.phoneNumber,
      merchantLocation:
        orderFound?.merchantId?.merchantDetail?.location || null,
      deliveryTime: formatTime(orderFound.orderDetail.deliveryTime),
      billDetail: orderFound.billDetail,
      orderDetail: orderFound.orderDetail,
      ETA: formatToHours(timeDiff),
    };

    res.status(200).json({
      messsage: "Ongoing order",
      data: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

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

const getVisibilityOfReferal = async (req, res, next) => {
  try {
    const referalFound = await Referral.find({ status: true });

    let status = referalFound.length >= 1 ? true : false;

    res.status(200).json({ status });
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
  getCustomerOrdersController,
  getsingleOrderDetailController,
  getTransactionOfCustomerController,
  getCustomerSubscriptionDetailController,
  getPromocodesOfCustomerController,
  searchPromocodeController,
  searchOrderController,
  getWalletAndLoyaltyController,
  getCustomerCartController,
  getCustomerAppBannerController,
  getSpalshScreenImageController,
  getPickAndDropBannersController,
  getCustomOrderBannersController,
  getAvailableServiceController,
  generateReferralCode,
  getCurrentOrderDetailcontroller,
  getAllNotificationsOfCustomerController,
  getVisibilityOfReferal,
};
