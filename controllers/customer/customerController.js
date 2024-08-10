const appError = require("../../utils/appError");
const generateToken = require("../../utils/generateToken");
const os = require("os");
const Customer = require("../../models/Customer");
const { validationResult } = require("express-validator");
const geoLocation = require("../../utils/getGeoLocation");
const {
  deleteFromFirebase,
  uploadToFirebase,
} = require("../../utils/imageOperation");
const {
  getDistanceFromPickupToDelivery,
} = require("../../utils/customerAppHelpers");
const CustomerCart = require("../../models/CustomerCart");
const mongoose = require("mongoose");
const PromoCode = require("../../models/PromoCode");
const {
  createRazorpayOrderId,
  verifyPayment,
} = require("../../utils/razorpayPayment");
const Order = require("../../models/Order");
const Agent = require("../../models/Agent");
const { formatDate, formatTime } = require("../../utils/formatters");
const CustomerSubscription = require("../../models/CustomerSubscription");
const CustomerAppCustomization = require("../../models/CustomerAppCustomization");
const PickAndDropBanner = require("../../models/PickAndDropBanner");
const CustomOrderBanner = require("../../models/CustomOrderBanner");
const Banner = require("../../models/Banner");

// Register or login customer
const registerAndLoginController = async (req, res, next) => {
  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const { email, phoneNumber, latitude, longitude } = req.body;
    const location = [latitude, longitude];

    const normalizedEmail = email?.toLowerCase();

    let customer = {};

    if (email) {
      customer = await Customer.findOne({ email: normalizedEmail });
    } else {
      customer = await Customer.findOne({ phoneNumber });
    }

    if (customer) {
      if (customer.customerDetails.isBlocked) {
        return res.status(400).json({
          message: "Account is Blocked",
        });
      } else {
        const geofence = await geoLocation(latitude, longitude, next);

        customer.lastPlatformUsed = os.platform();
        customer.customerDetails.geofenceId = geofence._id;

        await customer.save();

        return res.status(200).json({
          success: "User logged in successfully",
          id: customer.id,
          token: generateToken(customer.id, customer.role),
          role: customer.role,
        });
      }
    } else {
      const geofence = await geoLocation(latitude, longitude, next);

      if (!geofence) {
        return res.status(400).json({
          message: "User coordinates are outside defined geofences",
        });
      }

      // Create new customer based on email or phoneNumber
      const newCustomerData = email
        ? { email: normalizedEmail }
        : { phoneNumber };

      const newCustomer = new Customer({
        ...newCustomerData,
        lastPlatformUsed: os.platform(),
        customerDetails: {
          location,
          geofenceId: geofence._id,
        },
      });

      await newCustomer.save();

      return res.status(201).json({
        success: "User created successfully",
        id: newCustomer.id,
        token: generateToken(newCustomer.id),
      });
    }
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
      _id: currentCustomer._id,
      fullName: currentCustomer.fullName || "N/A",
      email: currentCustomer.email || "N/A",
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
  const { fullName, email } = req.body;

  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const currentCustomer = await Customer.findById(req.userAuth);

    if (!currentCustomer) {
      return next(appError("Customer not found", 404));
    }

    const normalizedEmail = email.toLowerCase();

    if (normalizedEmail !== currentCustomer.email) {
      const emailExists = await Customer.findOne({
        _id: { $ne: req.userAuth },
        email: normalizedEmail,
      });

      if (emailExists) {
        formattedErrors.email = "Email already exists";
        return res.status(409).json({ errors: formattedErrors });
      }
    }

    let customerImageURL =
      currentCustomer?.customerDetails?.customerImageURL || "";

    if (req.file) {
      if (customerImageURL !== "") {
        await deleteFromFirebase(customerImageURL);
      }
      customerImageURL = await uploadToFirebase(req.file, "CustomerImages");
    }

    const updatedFields = {
      fullName,
      email,
      customerDetails: {
        customerImageURL,
      },
    };

    const updatedCustomer = await Customer.findByIdAndUpdate(
      req.userAuth,
      { $set: updatedFields },
      { new: true }
    );

    if (!updatedCustomer) {
      return next(appError("Error in updating customer"));
    }

    res.status(200).json({ message: "Customer updated successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

// Update customer address details
const updateCustomerAddressController = async (req, res, next) => {
  const { addresses } = req.body;

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const currentCustomer = await Customer.findById(req.userAuth);

    if (!currentCustomer) {
      return next(appError("Customer not found", 404));
    }

    let newOtherAddresses = [...currentCustomer.customerDetails.otherAddress];

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
            // Update existing other address
            const index = newOtherAddresses.findIndex(
              (addr) => addr.id.toString() === id.toString()
            );
            if (index !== -1) {
              newOtherAddresses[index] = { id, ...updatedAddress };
            } else {
              newOtherAddresses.push({ id, ...updatedAddress });
            }
          } else {
            // Add new other address with a new id
            newOtherAddresses.push({
              id: new mongoose.Types.ObjectId(),
              ...updatedAddress,
            });
          }
          break;
        default:
          throw new Error("Invalid address type");
      }
    });

    // Replace otherAddress array with newOtherAddresses
    currentCustomer.customerDetails.otherAddress = newOtherAddresses;

    await currentCustomer.save();

    res
      .status(200)
      .json({ message: "Customer addresses updated successfully" });
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
    const { paymentDetails, amount, customerId } = req.body;
    // const customerId = req.userAuth;

    if (!customerId) {
      return next(appError("Customer is not authenticated", 401));
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

    console.log("here");

    const customer = await Customer.findById(currentCustomer)
      .select("customerDetails.location customerDetails.favoriteMerchants")
      .populate("customerDetails.favoriteMerchants");

    if (!customer || !customer.customerDetails) {
      return next(appError("Customer details not found", 404));
    }

    const favoriteMerchants = customer.customerDetails.favoriteMerchants;

    const customerLocation = customer.customerDetails.location;

    const simplifiedMerchants = await Promise.all(
      favoriteMerchants.map(async (merchant) => {
        const merchantLocation = merchant.merchantDetail.location;
        const distance = await getDistanceFromPickupToDelivery(
          merchantLocation,
          customerLocation
        );

        // Determine if the merchant is a favorite
        const isFavorite =
          currentCustomer?.customerDetails?.favoriteMerchants?.includes(
            merchant._id
          ) ?? false;

        return {
          _id: merchant._id,
          merchantName: merchant.merchantDetail.merchantName,
          deliveryTime: merchant.merchantDetail.deliveryTime,
          description: merchant.merchantDetail.description,
          averageRating: merchant.merchantDetail.averageRating,
          status: merchant.status,
          distanceInKM: parseFloat(distance),
          restaurantType: merchant.merchantDetail.merchantFoodType || "N/A",
          merchantImageURL: merchant.merchantDetail.merchantImageURL,
          isFavorite,
        };
      })
    );

    res.status(200).json({
      message: "Favourite merchants retrieved successfully",
      data: simplifiedMerchants,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get all orders of customer in latest order
const getCustomerOrdersController = async (req, res, next) => {
  try {
    const currentCustomer = req.userAuth;

    const ordersOfCustomer = await Order.find({ customerId: currentCustomer })
      .sort({ createdAt: -1 })
      .populate({
        path: "merchantId",
        select: "merchantDetail",
      })
      .populate({
        path: "items.productId",
        select: "productName productImageURL description variants",
      })
      .exec();

    const populatedOrdersWithVariantNames = ordersOfCustomer.map((order) => {
      const orderObj = order.toObject();
      orderObj.items = orderObj.items.map((item) => {
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
              _id: variantType._id,
              variantTypeName: variantTypeName,
            };
          }
        }
        return {
          ...item,
          productId: {
            _id: product._id,
            productName: product.productName,
            description: product.description,
            productImageURL: product.productImageURL,
          },
          variantTypeId: variantTypeData,
        };
      });
      return orderObj;
    });

    const formattedResponse = populatedOrdersWithVariantNames.map((order) => {
      return {
        _id: order._id,
        merchantName: order.merchantId.merchantDetail.merchantName,
        displayAddress: order.merchantId.merchantDetail.displayAddress,
        orderStatus: order.status,
        orderDate: `${formatDate(order.createdAt)} | ${formatTime(
          order.createdAt
        )}`,
        items: order.items,
        grandTotal: order.billDetail.grandTotal,
      };
    });

    console.log(formattedResponse);

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
      .populate({
        path: "items.productId",
        select: "productName productImageURL description variants",
      })
      .exec();

    if (!singleOrderDetail) {
      return next(appError("Order not found", 404));
    }

    const customer = await Customer.findById(currentCustomer).select(
      "customerDetails.location"
    );

    const orderObj = singleOrderDetail.toObject();
    orderObj.items = orderObj.items.map((item) => {
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
            _id: variantType._id,
            variantTypeName: variantTypeName,
          };
        }
      }
      return {
        ...item,
        productId: {
          _id: product._id,
          productName: product.productName,
          description: product.description,
          productImageURL: product.productImageURL,
        },
        variantTypeId: variantTypeData,
      };
    });

    const distance = await getDistanceFromPickupToDelivery(
      orderObj.merchantId.merchantDetail.location,
      customer.customerDetails.location[0]
    );

    const formattedResponse = {
      _id: orderObj._id,
      merchantName: orderObj.merchantId.merchantDetail.merchantName,
      displayAddress: orderObj.merchantId.merchantDetail.displayAddress,
      deliveryTime: orderObj.merchantId.merchantDetail.deliveryTime,
      distance,
      items: orderObj.items,
      billDetail: orderObj.billDetail,
      deliveryAddress: orderObj.orderDetail.deliveryAddress,
      orderDate: `${formatDate(orderObj.createdAt)}`,
      orderTime: `${formatTime(orderObj.createdAt)}`,
      paymentMode: orderObj.paymentMode,
      merchantPhone: orderObj.merchantId.phoneNumber,
      fssaiNumber: orderObj.merchantId.merchantDetail.FSSAINumber,
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

    console.log("Customer ID:", currentCustomer);
    console.log("Search Query:", query);

    const ordersOfCustomer = await Order.find({
      customerId: currentCustomer,
    })
      .sort({ createdAt: -1 })
      .populate({
        path: "merchantId",
        select: "merchantDetail",
      })
      .populate({
        path: "items.productId",
        select: "productName productImageURL description variants",
      })
      .exec();

    // Filter orders based on the search query
    const filteredOrders = ordersOfCustomer.filter((order) => {
      const merchantName =
        order.merchantId.merchantDetail.merchantName.toLowerCase();
      const items = order.items.some((item) => {
        return item.productId.productName
          .toLowerCase()
          .includes(query.toLowerCase());
      });
      return merchantName.includes(query.toLowerCase()) || items;
    });

    console.log("Orders Found:", filteredOrders.length);

    const populatedOrdersWithVariantNames = filteredOrders.map((order) => {
      const orderObj = order.toObject();
      orderObj.items = orderObj.items.map((item) => {
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
              _id: variantType._id,
              variantTypeName: variantTypeName,
            };
          }
        }
        return {
          ...item,
          productId: {
            _id: product._id,
            productName: product.productName,
            description: product.description,
            productImageURL: product.productImageURL,
          },
          variantTypeId: variantTypeData,
        };
      });
      return orderObj;
    });

    const formattedResponse = populatedOrdersWithVariantNames.map((order) => {
      return {
        _id: order._id,
        merchantName: order.merchantId.merchantDetail.merchantName,
        displayAddress: order.merchantId.merchantDetail.displayAddress,
        orderStatus: order.status,
        orderDate: `${formatDate(order.createdAt)} | ${formatTime(
          order.createdAt
        )}`,
        items: order.items,
        grandTotal: order.billDetail.grandTotal,
      };
    });

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
        customerName: customerFound.fullName || "N/A",
        customerImage:
          customerFound.customerDetails.customerImageURL ||
          "https://firebasestorage.googleapis.com/v0/b/famto-aa73e.appspot.com/o/AgentImages%2Fdemo-image.png-0fe7a62e-6d1c-4e5f-9d3c-87698bdfc32e?alt=media&token=97737725-250d-481e-a8db-69bdaedbb073",
        transactionAmount: transaction.transactionAmount,
        transactionType: transaction.transactionType,
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

    const currentSubscriptionLog = await Customer.findById(currentCustomer)
      .select("customerDetails")
      .populate({
        path: "customerDetails.pricing",
        model: "SubscriptionLog",
      })
      .exec();

    if (
      !currentSubscriptionLog ||
      !currentSubscriptionLog.customerDetails.pricing ||
      !currentSubscriptionLog.customerDetails.pricing.length
    ) {
      return res.status(404).json({
        message: "No active subscription plan found for the customer.",
      });
    }

    const currentSubscriptionPlanId =
      currentSubscriptionLog.customerDetails.pricing[0].planId;

    const currentSubscription = await CustomerSubscription.findById(
      currentSubscriptionPlanId
    );

    if (!currentSubscription) {
      return res.status(404).json({
        message: "Subscription plan not found.",
      });
    }

    const startDate =
      currentSubscriptionLog.customerDetails.pricing[0].startDate;
    const endDate = currentSubscriptionLog.customerDetails.pricing[0].endDate;

    const currentDate = new Date();
    const endDateObject = new Date(endDate);

    const timeDiff = endDateObject - currentDate;
    const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

    const formattedCurrentSubscriptionPlan = {
      planName: currentSubscription.name,
      duration: currentSubscription.duration,
      amount: currentSubscription.amount,
      description: currentSubscription.description,
      daysLeft,
    };

    res.status(200).json({
      message: "Subscription plan details",
      data: {
        allSubscriptionPlans,
        currentSubscription: formattedCurrentSubscriptionPlan,
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
      toDate: { $gte: currentDate },
      $expr: { $lt: ["$noOfUserUsed", "$maxAllowedUsers"] },
    });

    const formattedResponse = promocodesFound.map((promo) => {
      return {
        _id: promo._id,
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
        _id: promo._id,
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
                _id: variantType._id,
                variantTypeName: variantTypeName,
              };
            }
          }
          return {
            ...item,
            productId: {
              _id: product._id,
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
      data: populatedCartWithVariantNames || {},
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
      data: spalshScreenImage,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getCustomerAppBannerController = async (req, res, next) => {
  try {
    const allBanners = await Banner.find({ status: true }).select(
      "name imageUrl"
    );

    res.status(200).json({
      message: "All Banners",
      data: allBanners,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getPickAndDropBannersController = async (req, res, next) => {
  try {
    const allBanners = await PickAndDropBanner.find({ status: true }).select(
      "title description imageUrl"
    );

    res.status(200).json({
      message: "All Pick and Drop Banners",
      data: allBanners,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getCustomOrderBannersController = async (req, res, next) => {
  try {
    const allBanners = await CustomOrderBanner.find({ status: true }).select(
      "title description imageUrl"
    );

    res.status(200).json({
      message: "All Custom Order Banners",
      data: allBanners,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  registerAndLoginController,
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
};
