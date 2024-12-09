const mongoose = require("mongoose");
const turf = require("@turf/turf");
const { validationResult } = require("express-validator");

const Customer = require("../../models/Customer");
const Product = require("../../models/Product");
const BusinessCategory = require("../../models/BusinessCategory");
const Merchant = require("../../models/Merchant");
const Category = require("../../models/Category");
const CustomerCart = require("../../models/CustomerCart");
const PromoCode = require("../../models/PromoCode");
const Order = require("../../models/Order");
const ScheduledOrder = require("../../models/ScheduledOrder");
const SubscriptionLog = require("../../models/SubscriptionLog");
const TemporaryOrder = require("../../models/TemporaryOrder");
const NotificationSetting = require("../../models/NotificationSetting");

const {
  sortMerchantsBySponsorship,
  getDistanceFromPickupToDelivery,
  calculateDiscountedPrice,
  filterProductIdAndQuantity,
  fetchCustomerAndMerchantAndCart,
  processVoiceInstructions,
  getDiscountAmountFromLoyalty,
  calculateScheduledCartValue,
  calculatePromoCodeDiscount,
  applyPromoCodeDiscount,
  populateCartDetails,
} = require("../../utils/customerAppHelpers");
const {
  createRazorpayOrderId,
  verifyPayment,
  razorpayRefund,
} = require("../../utils/razorpayPayment");
const { formatDate, formatTime } = require("../../utils/formatters");

const appError = require("../../utils/appError");
const geoLocation = require("../../utils/getGeoLocation");

const { sendNotification, sendSocketData } = require("../../socket/socket");
const {
  validateDeliveryOption,
  processHomeDeliveryDetailInApp,
  calculateDeliveryChargesHelper,
  applyDiscounts,
  calculateBill,
  processScheduledDelivery,
} = require("../../utils/createOrderHelpers");
const Task = require("../../models/Task");

// Get all available business categories according to the order
const getAllBusinessCategoryController = async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude)
      return next(appError("Latitude & Longitude are required", 400));

    const geofence = await geoLocation(latitude, longitude);

    if (!geofence)
      return next(appError("Customer is outside the listed geofences", 500));

    const allBusinessCategories = await BusinessCategory.find({
      status: true,
      geofenceId: { $in: [geofence._id] },
    })
      .select("title bannerImageURL")
      .sort({ order: 1 });

    const formattedResponse = allBusinessCategories?.map((category) => {
      return {
        id: category._id,
        title: category.title,
        bannerImageURL: category.bannerImageURL,
      };
    });

    res.status(200).json({
      message: "All business categories",
      data: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// search for Business category in the home
const homeSearchController = async (req, res, next) => {
  const { query } = req.query;

  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    // Search in BusinessCategory by title
    const businessCategories = await BusinessCategory.find({
      title: { $regex: query, $options: "i" },
    })
      .select("title bannerImageURL")
      .exec();

    const formattedBusinessCategoryResponse = businessCategories?.map(
      (category) => {
        return {
          id: category._id,
          title: category.title,
          bannerImageURL: category.bannerImageURL,
        };
      }
    );

    res.status(200).json({
      message: "Search results",
      data: formattedBusinessCategoryResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// List the available restaurants in the customers geofence
const listRestaurantsController = async (req, res, next) => {
  const { latitude, longitude, businessCategoryId } = req.body;

  try {
    const customerId = req.userAuth;

    const currentCustomer = await Customer.findById(customerId)
      .select("customerDetails.favoriteMerchants")
      .exec();

    if (!currentCustomer) return next(appError("Customer not found", 404));

    const customerLocation = [latitude, longitude];

    const foundGeofence = await geoLocation(latitude, longitude);

    if (!foundGeofence) return next(appError("Geofence not found", 404));

    const merchants = await Merchant.find({
      "merchantDetail.geofenceId": foundGeofence._id,
      "merchantDetail.businessCategoryId": { $in: [businessCategoryId] },
      "merchantDetail.pricing.0": { $exists: true },
      "merchantDetail.pricing.modelType": { $exists: true }, // Ensures modelType exists
      "merchantDetail.pricing.modelId": { $exists: true },
      "merchantDetail.location": { $ne: [] },
      isBlocked: false,
      isApproved: "Approved",
    }).exec();

    const filteredMerchants = merchants?.filter((merchant) => {
      const servingRadius = merchant.merchantDetail.servingRadius || 0;
      if (servingRadius > 0) {
        const merchantLocation = merchant.merchantDetail.location;
        const distance = turf.distance(
          turf.point(merchantLocation),
          turf.point(customerLocation),
          { units: "kilometers" }
        );
        return distance <= servingRadius;
      }
      return true;
    });

    const sortedMerchants = await sortMerchantsBySponsorship(filteredMerchants);

    const simplifiedMerchants = await Promise.all(
      sortedMerchants.map(async (merchant) => {
        const isFavorite =
          currentCustomer?.customerDetails?.favoriteMerchants?.includes(
            merchant._id
          ) ?? false;

        return {
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
          isFavorite,
        };
      })
    );

    res.status(200).json({
      message: "Available merchants",
      data: simplifiedMerchants,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get all categories of merchant
const getAllCategoriesOfMerchants = async (req, res, next) => {
  try {
    const { merchantId, businessCategoryId } = req.params;

    const [merchantFound, customerFound] = await Promise.all([
      Merchant.findById(merchantId),
      Customer.findById(req.userAuth),
    ]);

    if (!merchantFound) return next(appError("Merchant not found", 404));
    if (!customerFound) return next(appError("Customer not found", 404));

    const merchantLocation = merchantFound.merchantDetail.location;
    const customerLocation = customerFound.customerDetails.location;

    let distanceInKM;

    const distance = await getDistanceFromPickupToDelivery(
      merchantLocation,
      customerLocation
    );

    distanceInKM = distance.distanceInKM;

    let distanceWarning = false;
    if (distanceInKM > 12) distanceWarning = true;

    let isFavourite = false;

    if (
      customerFound.customerDetails.favoriteMerchants.includes(
        merchantFound._id
      )
    ) {
      isFavourite = true;
    }

    const merchantData = {
      merchantName: merchantFound.merchantDetail.merchantName,
      distanceInKM: distanceInKM || null,
      deliveryTime: merchantFound.merchantDetail.deliveryTime,
      merchantImageURL:
        merchantFound?.merchantDetail?.merchantImageURL ||
        "https://firebasestorage.googleapis.com/v0/b/famto-aa73e.appspot.com/o/DefaultImages%2FMerchantDefaultImage.png?alt=media&token=a7a11e18-047c-43d9-89e3-8e35d0a4e231",
      description: merchantFound.merchantDetail.description,
      displayAddress: merchantFound.merchantDetail.displayAddress,
      preOrderStatus: merchantFound.merchantDetail.preOrderStatus,
      rating: merchantFound.merchantDetail.averageRating,
      isFavourite,
      distanceWarning,
    };

    const allCategories = await Category.find({
      businessCategoryId,
      merchantId,
    }).sort({
      order: 1,
    });

    const formattedResponse = allCategories?.map((category) => {
      return {
        categoryId: category._id,
        categoryName: category?.categoryName || null,
        description: category?.description || null,
        type: category?.type || null,
        categoryImageURL: category?.categoryImageURL || null,
        status: category?.status || null,
      };
    });

    res.status(200).json({
      message: "All categories",
      data: {
        merchantData,
        categoryData: formattedResponse,
      },
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get all product of a category
const getAllProductsOfMerchantController = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const customerId = req.userAuth;

    const currentCustomer = await Customer.findById(customerId)
      .select("customerDetails.favoriteProducts")
      .exec();

    if (!currentCustomer) return next(appError("Customer not found", 404));

    const allProducts = await Product.find({ categoryId })
      .populate(
        "discountId",
        "discountName maxAmount discountType discountValue validFrom validTo onAddOn status"
      )
      .sort({ order: 1 });

    const productsWithDetails = allProducts.map((product) => {
      const currentDate = new Date();
      const validFrom = new Date(product?.discountId?.validFrom);
      const validTo = new Date(product?.discountId?.validTo);

      // Adjusting the validTo date to the end of the day
      validTo?.setHours(18, 29, 59, 999);

      let discountPrice = null;

      // Calculate the discount price if applicable
      if (
        product?.discountId &&
        validFrom <= currentDate &&
        validTo >= currentDate &&
        product?.discountId?.status
      ) {
        const discount = product.discountId;

        if (discount.discountType === "Percentage-discount") {
          let discountAmount = (product.price * discount.discountValue) / 100;
          if (discountAmount > discount.maxAmount) {
            discountAmount = discount.maxAmount;
          }
          discountPrice = Math.max(0, product.price - discountAmount);
        } else if (discount.discountType === "Flat-discount") {
          discountPrice = Math.max(0, product.price - discount.discountValue);
        }
      }

      const isFavorite =
        currentCustomer?.customerDetails?.favoriteProducts?.includes(
          product._id
        ) ?? false;

      return {
        productId: product._id,
        productName: product.productName || null,
        price: product.price || null,
        discountPrice: Math.round(discountPrice) || null,
        minQuantityToOrder: product.minQuantityToOrder || null,
        maxQuantityPerOrder: product.maxQuantityPerOrder || null,
        isFavorite,
        preparationTime: `${product.preparationTime} min` || null,
        description: product.description || null,
        longDescription: product.longDescription || null,
        type: product.type || null,
        productImageURL:
          product.productImageURL ||
          "https://firebasestorage.googleapis.com/v0/b/famto-aa73e.appspot.com/o/DefaultImages%2FProductDefaultImage.png?alt=media&token=044503ee-84c8-487b-9df7-793ad0f70e1c",
        inventory: product.inventory || null,
        variantAvailable: product.variants && product.variants.length > 0, // Check if variants are available
      };
    });

    res.status(200).json({
      message: "All products",
      data: productsWithDetails,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get variants of a product
const getProductVariantsByProductIdController = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId)
      .populate(
        "discountId",
        "discountType discountValue maxAmount status validFrom validTo onAddOn"
      )
      .exec();

    if (!product) return next(appError("Product not found", 404));

    const currentDate = new Date();
    const validFrom = new Date(product?.discountId?.validFrom);
    const validTo = new Date(product?.discountId?.validTo);
    validTo?.setHours(18, 29, 59, 999);

    let variantsWithDiscount = product.variants.map((variant) => {
      return {
        ...variant._doc,
        variantTypes: variant.variantTypes.map((variantType) => ({
          ...variantType._doc,
          discountPrice: null, // Default discount price is null
        })),
      };
    });

    // Apply discount if applicable
    if (
      product?.discountId &&
      validFrom <= currentDate &&
      validTo >= currentDate &&
      product?.discountId?.status
    ) {
      const discount = product.discountId;

      if (discount.onAddOn) {
        variantsWithDiscount = product.variants.map((variant) => {
          const variantTypesWithDiscount = variant.variantTypes.map(
            (variantType) => {
              let variantDiscountPrice = variantType.price;
              if (discount.discountType === "Percentage-discount") {
                let discountAmount =
                  (variantType.price * discount.discountValue) / 100;
                if (discountAmount > discount.maxAmount) {
                  discountAmount = discount.maxAmount;
                }
                variantDiscountPrice = Math.max(
                  0,
                  variantType.price - discountAmount
                );
              } else if (discount.discountType === "Flat-discount") {
                variantDiscountPrice = Math.max(
                  0,
                  variantType.price - discount.discountValue
                );
              }

              return {
                ...variantType._doc,
                discountPrice: Math.round(variantDiscountPrice),
              };
            }
          );
          return {
            ...variant._doc,
            variantTypes: variantTypesWithDiscount,
          };
        });
      }
    }

    res.status(200).json({
      message: "Product variants",
      data: variantsWithDiscount,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Filter merchants based on (Pure veg, Rating, Nearby)
const filterAndSearchMerchantController = async (req, res, next) => {
  try {
    const { businessCategoryId, filterType, query = "" } = req.query;
    const customerId = req.userAuth;

    // Validate required inputs
    if (!businessCategoryId)
      return next(appError("Business category is required", 400));

    // Fetch customer and validate existence
    const customer = await Customer.findById(customerId).select(
      "customerDetails.location"
    );
    if (!customer) return next(appError("Customer not found", 404));

    const foundGeofence = await geoLocation(
      customer.customerDetails.location[0],
      customer.customerDetails.location[1]
    );

    if (!foundGeofence) return next(appError("Geofence not found", 404));

    // Define base filter criteria
    const filterCriteria = {
      isBlocked: false,
      isApproved: "Approved",
      "merchantDetail.geofenceId": foundGeofence._id,
      "merchantDetail.businessCategoryId": { $in: [businessCategoryId] },
      "merchantDetail.pricing.0": { $exists: true },
      "merchantDetail.pricing.modelType": { $exists: true },
      "merchantDetail.pricing.modelId": { $exists: true },
      "merchantDetail.location": { $exists: true, $ne: [] },
    };

    // Apply additional filters based on filterType
    if (query) {
      filterCriteria["merchantDetail.merchantName"] = {
        $regex: query.trim(),
        $options: "i",
      };
    }
    if (filterType === "Veg") {
      filterCriteria["merchantDetail.merchantFoodType"] = "Veg";
    } else if (filterType === "Rating") {
      filterCriteria["merchantDetail.averageRating"] = { $gte: 4.0 };
    }

    // Fetch merchants based on filter criteria
    let merchants = await Merchant.find(filterCriteria).lean();

    const customerLocation = customer.customerDetails.location;
    // Apply "Nearby" filter if required
    const turf = require("@turf/turf");
    if (filterType === "Nearby" && customerLocation) {
      merchants = merchants.filter((merchant) => {
        const servingRadius = merchant.merchantDetail.servingRadius || 0;
        const merchantLocation = merchant.merchantDetail.location;
        if (servingRadius > 0 && Array.isArray(merchantLocation)) {
          const distance = turf.distance(
            turf.point(merchantLocation),
            turf.point(customerLocation),
            { units: "kilometers" }
          );
          return distance <= servingRadius;
        }
        return true;
      });
    }

    // Sort merchants by sponsorship or other criteria
    const sortedMerchants = sortMerchantsBySponsorship(merchants);

    // Map sorted merchants to response format
    const responseMerchants = sortedMerchants.map((merchant) => {
      const isFavorite =
        customer?.customerDetails?.favoriteMerchants?.includes(merchant._id) ??
        false;

      return {
        id: merchant._id,
        merchantName: merchant.merchantDetail.merchantName,
        description: merchant.merchantDetail.description || "",
        averageRating: merchant.merchantDetail.averageRating || 0,
        status: merchant?.status,
        restaurantType: merchant?.merchantDetail?.merchantFoodType || null,
        merchantImageURL: merchant.merchantDetail.merchantImageURL || null,
        displayAddress: merchant.merchantDetail.displayAddress || null,
        preOrderStatus: merchant?.merchantDetail?.preOrderStatus,
        isFavorite,
      };
    });

    // Respond with filtered merchants
    res.status(200).json({
      message: "Filtered and searched merchants",
      data: responseMerchants,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const searchProductsInMerchantToOrderController = async (req, res, next) => {
  try {
    const { merchantId, businessCategoryId } = req.params;
    const { query } = req.query;

    // Find all categories belonging to the merchant with the given business category
    const categories = await Category.find({ merchantId, businessCategoryId });

    // Extract all category ids to search products within all these categories
    const categoryIds = categories.map((category) => category._id);

    // Search products within the found categoryIds
    const products = await Product.find({
      categoryId: { $in: categoryIds },
      $or: [
        { productName: { $regex: query, $options: "i" } },
        { searchTags: { $elemMatch: { $regex: query, $options: "i" } } },
      ],
    })
      .populate(
        "discountId",
        "discountName maxAmount discountType discountValue validFrom validTo onAddOn status"
      )
      .select(
        "_id productName price description discountId productImageURL inventory variants"
      )
      .sort({ order: 1 });

    const currentDate = new Date();

    const formattedResponse = products?.map((product) => {
      const discount = product?.discountId;
      const validFrom = new Date(discount?.validFrom);
      const validTo = new Date(discount?.validTo);
      validTo?.setHours(23, 59, 59, 999); // Adjust validTo to the end of the day

      let discountPrice = null;

      // Check if discount is applicable
      if (
        discount &&
        validFrom <= currentDate &&
        validTo >= currentDate &&
        discount.status
      ) {
        if (discount.onAddOn) {
          // Apply discount to each variant type price if onAddOn is true
          return {
            id: product._id,
            productName: product.productName,
            price: product.price,
            discountPrice: null,
            description: product.description,
            productImageUrl:
              product?.productImageURL ||
              "https://firebasestorage.googleapis.com/v0/b/famto-aa73e.appspot.com/o/DefaultImages%2FProductDefaultImage.png?alt=media&token=044503ee-84c8-487b-9df7-793ad0f70e1c",
            variants: product.variants.map((variant) => ({
              id: variant._id,
              variantName: variant.variantName,
              variantTypes: variant.variantTypes.map((variantType) => {
                let variantDiscountPrice = null;

                if (discount.discountType === "Percentage-discount") {
                  let discountAmount =
                    (variantType.price * discount.discountValue) / 100;
                  if (discountAmount > discount.maxAmount)
                    discountAmount = discount.maxAmount;
                  variantDiscountPrice = Math.round(
                    Math.max(0, variantType.price - discountAmount)
                  );
                } else if (discount.discountType === "Flat-discount") {
                  variantDiscountPrice = Math.round(
                    Math.max(0, variantType.price - discount.discountValue)
                  );
                }

                return {
                  id: variantType._id,
                  typeName: variantType.typeName,
                  price: variantType.price,
                  discountPrice: variantDiscountPrice,
                };
              }),
            })),
          };
        } else {
          // Apply discount to the main product price if onAddOn is false
          if (discount.discountType === "Percentage-discount") {
            let discountAmount = (product.price * discount.discountValue) / 100;
            if (discountAmount > discount.maxAmount)
              discountAmount = discount.maxAmount;
            discountPrice = Math.round(
              Math.max(0, product.price - discountAmount)
            );
          } else if (discount.discountType === "Flat-discount") {
            discountPrice = Math.round(
              Math.max(0, product.price - discount.discountValue)
            );
          }
        }
      }

      // Return a unified format regardless of discount type or application
      return {
        id: product._id,
        productName: product.productName,
        price: product.price,
        discountPrice, // Null if no discount or discount is applied to variants
        description: product.description,
        productImageUrl:
          product?.productImageURL ||
          "https://firebasestorage.googleapis.com/v0/b/famto-aa73e.appspot.com/o/DefaultImages%2FProductDefaultImage.png?alt=media&token=044503ee-84c8-487b-9df7-793ad0f70e1c",
        variants: product.variants.map((variant) => ({
          id: variant._id,
          variantName: variant.variantName,
          variantTypes: variant.variantTypes.map((variantType) => ({
            id: variantType._id,
            typeName: variantType.typeName,
            price: variantType.price,
            discountPrice: discount?.onAddOn
              ? variantType.discountPrice || null
              : null,
          })),
        })),
      };
    });

    res.status(200).json({
      message: "Products found in merchant",
      data: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Filter and sort products
const filterAndSortAndSearchProductsController = async (req, res, next) => {
  try {
    const { merchantId } = req.params;
    const { filter, sort, productName } = req.query;

    const customerId = req.userAuth;

    const currentCustomer = await Customer.findById(customerId)
      .select("customerDetails.favoriteProducts")
      .exec();

    if (!currentCustomer) return next(appError("Customer not found", 404));

    // Get category IDs associated with the merchant
    const categories = await Category.find({ merchantId }).select("_id");
    const categoryIds = categories.map((category) => category._id);

    // Build the query object
    let query = { categoryId: { $in: categoryIds } };

    // Add filter conditions
    if (filter) {
      if (filter === "Veg") {
        query.type = filter;
      } else if (filter === "Favorite") {
        query._id = { $in: currentCustomer.customerDetails.favoriteProducts };
      }
    }

    if (productName) {
      query.productName = { $regex: productName.trim(), $options: "i" };
    }

    // Build the sort object
    let sortObj = {};
    if (sort) {
      if (sort === "Price - low to high") {
        sortObj.price = 1;
      } else if (sort === "Price - high to low") {
        sortObj.price = -1;
      }
    }

    // Fetch the filtered and sorted products
    const products = await Product.find(query)
      .select(
        "productName price longDescription type productImageURL inventory variants minQuantityToOrder maxQuantityPerOrder preparationTime description"
      )
      .sort(sortObj);

    const currentDate = new Date();

    const formattedResponse = products?.map((product) => {
      const isFavorite =
        currentCustomer?.customerDetails?.favoriteProducts?.includes(
          product._id
        ) ?? false;

      const discount = product?.discountId;
      const validFrom = new Date(discount?.validFrom);
      const validTo = new Date(discount?.validTo);
      validTo?.setHours(23, 59, 59, 999);

      let discountPrice = null;

      // Check if discount is applicable
      if (
        discount &&
        validFrom <= currentDate &&
        validTo >= currentDate &&
        discount.status
      ) {
        if (discount.discountType === "Percentage-discount") {
          let discountAmount = (product.price * discount.discountValue) / 100;
          if (discountAmount > discount.maxAmount)
            discountAmount = discount.maxAmount;
          discountPrice = Math.round(
            Math.max(0, product.price - discountAmount)
          );
        } else if (discount.discountType === "Flat-discount") {
          discountPrice = Math.round(
            Math.max(0, product.price - discount.discountValue)
          );
        }
      }

      return {
        productId: product._id,
        productName: product.productName || null,
        price: product.price || null,
        discountPrice: Math.round(discountPrice) || null,
        minQuantityToOrder: product.minQuantityToOrder || null,
        maxQuantityPerOrder: product.maxQuantityPerOrder || null,
        isFavorite,
        preparationTime: product?.preparationTime
          ? `${product.preparationTime} min`
          : null,
        description: product?.description || null,
        longDescription: product?.longDescription || null,
        type: product.type || null,
        productImageURL:
          product?.productImageURL ||
          "https://firebasestorage.googleapis.com/v0/b/famto-aa73e.appspot.com/o/DefaultImages%2FProductDefaultImage.png?alt=media&token=044503ee-84c8-487b-9df7-793ad0f70e1c",
        inventory: product.inventory || null,
        variantAvailable: product?.variants && product?.variants?.length > 0,
      };
    });

    res.status(200).json({
      success: true,
      products: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Add or remove Products from favorite
const toggleProductFavoriteController = async (req, res, next) => {
  try {
    const currentCustomer = await Customer.findById(req.userAuth);

    if (!currentCustomer) {
      return next(appError("Customer is not authenticated", 403));
    }

    const { productId } = req.params;

    const productFound = await Product.findById(productId);

    if (!productFound) {
      return next(appError("Product not found", 404));
    }

    const isFavorite =
      currentCustomer.customerDetails.favoriteProducts.includes(productId);

    if (isFavorite) {
      currentCustomer.customerDetails.favoriteProducts =
        currentCustomer.customerDetails.favoriteProducts.filter(
          (favorite) => favorite.toString() !== productId.toString()
        );

      await currentCustomer.save();

      res.status(200).json({
        message: "successfully removed product from favorite list",
      });
    } else {
      currentCustomer.customerDetails.favoriteProducts.push(productId);
      await currentCustomer.save();

      res.status(200).json({
        message: "successfully added product to favorite list",
      });
    }
  } catch (err) {
    next(appError(err.message));
  }
};

// Add or remove Merchants from favorite
const toggleMerchantFavoriteController = async (req, res, next) => {
  try {
    const currentCustomer = await Customer.findById(req.userAuth);

    if (!currentCustomer) {
      return next(appError("Customer is not authenticated", 403));
    }

    const { merchantId } = req.params;

    const merchantFound = await Merchant.findById(merchantId);

    if (!merchantFound) {
      return next(appError("Merchant not found", 404));
    }

    const isFavorite =
      currentCustomer.customerDetails.favoriteMerchants.includes(merchantId);

    if (isFavorite) {
      currentCustomer.customerDetails.favoriteMerchants =
        currentCustomer.customerDetails.favoriteMerchants.filter(
          (favorite) => favorite.toString() !== merchantId.toString()
        );

      await currentCustomer.save();

      res.status(200).json({
        message: "successfully removed merchant from favorite list",
      });
    } else {
      currentCustomer.customerDetails.favoriteMerchants.push(merchantId);
      await currentCustomer.save();

      res.status(200).json({
        message: "successfully added merchant to favorite list",
      });
    }
  } catch (err) {
    next(appError(err.message));
  }
};

// Add ratings to the merchant
const addRatingToMerchantController = async (req, res, next) => {
  const { review, rating } = req.body;

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
      return next(appError("Customer is not authenticated", 401));
    }

    const { merchantId } = req.params;

    const merchantFound = await Merchant.findById(merchantId);

    if (!merchantFound) {
      return next(appError("Merchant not found", 404));
    }

    const ratingData = {
      customerId: currentCustomer,
      review,
      rating,
    };

    merchantFound.merchantDetail.ratingByCustomers.push(ratingData);

    await merchantFound.save();

    res.status(200).json({ message: "Rating submitted successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get average rating and total rating count of merchant
const getTotalRatingOfMerchantController = async (req, res, next) => {
  try {
    const { merchantId } = req.params;

    const merchantFound = await Merchant.findById(merchantId);

    if (!merchantFound) {
      return next(appError("Merchant not found", 404));
    }

    const totalReviews =
      merchantFound?.merchantDetail?.ratingByCustomers?.length || 0;
    const averageRating = merchantFound?.merchantDetail?.averageRating || 0;

    res.status(200).json({
      message: "Rating details of merchant",
      totalReviews,
      averageRating,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Update cart items
const addOrUpdateCartItemController = async (req, res, next) => {
  try {
    const { productId, quantity, variantTypeId } = req.body;

    const customerId = req.userAuth;

    if (!customerId) {
      return next(appError("Customer is not authenticated", 401));
    }

    const product = await Product.findById(productId).populate(
      "categoryId discountId"
    );

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const merchantId = product.categoryId.merchantId;

    let variantType = null;
    if (variantTypeId) {
      variantType = product.variants
        .flatMap((variant) => variant.variantTypes)
        .find((vt) => vt._id.equals(variantTypeId));

      if (!variantType) {
        return res.status(400).json({
          error: "VariantType not found for this product",
        });
      }
    }

    const { discountPrice, variantsWithDiscount } = calculateDiscountedPrice(
      product,
      variantTypeId
    );

    let finalPrice = discountPrice;
    if (variantTypeId) {
      const variant = variantsWithDiscount
        .flatMap((variant) => variant.variantTypes)
        .find((vt) => vt._id.equals(variantTypeId));

      finalPrice = variant
        ? variant.discountPrice || variant.price
        : discountPrice;
    }

    let cart = await CustomerCart.findOne({ customerId });

    if (cart) {
      if (cart.merchantId !== merchantId) {
        cart.merchantId = merchantId;
        cart.items = [];
      }
    } else {
      cart = new CustomerCart({ customerId, merchantId, items: [] });
    }

    const existingItemIndex = cart.items.findIndex(
      (item) =>
        item.productId.equals(productId) &&
        ((variantTypeId &&
          item.variantTypeId &&
          item.variantTypeId.equals(variantTypeId)) ||
          (!variantTypeId && !item.variantTypeId))
    );

    if (existingItemIndex >= 0) {
      cart.items[existingItemIndex].quantity = quantity;
      cart.items[existingItemIndex].price = finalPrice;
      cart.items[existingItemIndex].totalPrice = quantity * finalPrice;

      if (cart.items[existingItemIndex].quantity <= 0) {
        cart.items.splice(existingItemIndex, 1);
      }
    } else {
      if (quantity > 0) {
        const newItem = {
          productId,
          quantity,
          price: finalPrice,
          totalPrice: quantity * finalPrice,
          variantTypeId: variantTypeId || null,
        };
        cart.items.push(newItem);
      }
    }

    // Calculate the itemTotal ensuring no NaN values
    cart.itemTotal = cart.items.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );

    await cart.save();

    if (cart.items.length === 0) {
      await CustomerCart.findByIdAndDelete(cart._id);
      return res.status(200).json({
        success: false,
      });
    }

    const updatedCart = await CustomerCart.findOne({ customerId })
      .populate({
        path: "items.productId",
        select: "productName productImageURL description variants",
      })
      .exec();

    const updatedCartWithVariantNames = updatedCart.toObject();

    updatedCartWithVariantNames.items = updatedCartWithVariantNames.items.map(
      (item) => {
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
      }
    );

    res.status(200).json({
      success: true,
      data: {
        cartId: updatedCartWithVariantNames._id,
        customerId: updatedCartWithVariantNames.customerId,
        billDetail: updatedCartWithVariantNames.billDetail,
        cartDetail: updatedCartWithVariantNames.cartDetail,
        createdAt: updatedCartWithVariantNames.createdAt,
        updatedAt: updatedCartWithVariantNames.updatedAt,
        items: updatedCartWithVariantNames.items,
        itemTotal: updatedCart.itemTotal,
      },
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get delivery option of merchant
const getDeliveryOptionOfMerchantController = async (req, res, next) => {
  try {
    const { merchantId } = req.params;

    const merchantFound = await Merchant.findById(merchantId);

    if (!merchantFound) return next(appError("Merchant not found", 404));

    const isScheduled = ["Scheduled", "Both"].includes(
      merchantFound.merchantDetail.deliveryOption
    )
      ? true
      : false;

    res.status(200).json({
      data: isScheduled,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Confirm Order detail (Add - address, items)
const confirmOrderDetailController = async (req, res, next) => {
  try {
    const {
      businessCategoryId,
      deliveryAddressType,
      deliveryAddressOtherAddressId,
      newDeliveryAddress,
      deliveryMode,
      instructionToMerchant,
      instructionToDeliveryAgent,
      ifScheduled,
    } = req.body;

    console.log("Ins mer:", instructionToMerchant);
    console.log("Ins del:", instructionToDeliveryAgent);
    console.log("Body:", req.body);
    console.log("File:", req.files);
    console.log("File:", req.file);

    const { customer, cart, merchant } = await fetchCustomerAndMerchantAndCart(
      req.userAuth,
      next
    );

    let deliveryOption = "On-demand";
    if (ifScheduled?.startDate && ifScheduled?.endDate && ifScheduled?.time) {
      deliveryOption = "Scheduled";
    }

    validateDeliveryOption(merchant, deliveryOption, next);

    const scheduledDetails = processScheduledDelivery(deliveryOption, req);

    const { voiceInstructionToMerchantURL, voiceInstructionToAgentURL } =
      await processVoiceInstructions(req, cart, next);

    console.log("mer url", voiceInstructionToMerchantURL);
    console.log("age url", voiceInstructionToAgentURL);

    const {
      pickupLocation,
      pickupAddress,
      deliveryLocation,
      deliveryAddress,
      distance,
    } = await processHomeDeliveryDetailInApp(
      deliveryMode,
      customer,
      merchant,
      deliveryAddressType,
      deliveryAddressOtherAddressId,
      newDeliveryAddress
    );

    const cartItems = cart.items;

    const {
      oneTimeDeliveryCharge,
      surgeCharges,
      deliveryChargeForScheduledOrder,
      taxAmount,
      itemTotal,
    } = await calculateDeliveryChargesHelper(
      deliveryMode,
      distance,
      merchant,
      customer,
      cartItems,
      scheduledDetails,
      businessCategoryId
    );

    const merchantDiscountAmount = await applyDiscounts({
      items: cartItems,
      itemTotal,
      merchant,
    });

    const loyaltyDiscount = await getDiscountAmountFromLoyalty(
      customer,
      itemTotal
    );

    const discountTotal = merchantDiscountAmount + loyaltyDiscount;

    let actualDeliveryCharge = 0;

    const subscriptionOfCustomer = customer.customerDetails.pricing;

    if (subscriptionOfCustomer?.length > 0) {
      const subscriptionLog = await SubscriptionLog.findById(
        subscriptionOfCustomer[0]
      );

      if (subscriptionLog) {
        const now = new Date();

        if (
          (new Date(subscriptionLog?.startDate) < now ||
            new Date(subscriptionLog?.endDate) > now) &&
          subscriptionLog?.currentNumberOfOrders < subscriptionLog?.maxOrders
        ) {
          actualDeliveryCharge = 0;
        }
      }
    } else {
      actualDeliveryCharge = oneTimeDeliveryCharge;
    }

    const billDetail = calculateBill(
      itemTotal,
      deliveryChargeForScheduledOrder || actualDeliveryCharge || 0,
      surgeCharges || 0,
      0, // Place holder for flat discount (don't change)
      discountTotal,
      taxAmount || 0,
      cart?.billDetail?.addedTip || 0
    );

    const customerCart = await CustomerCart.findOneAndUpdate(
      { customerId: customer._id },
      {
        customerId: customer._id,
        merchantId: merchant._id,
        items: cart.items,
        cartDetail: {
          ...req.body,
          pickupLocation,
          pickupAddress,
          deliveryLocation,
          deliveryAddress,
          deliveryOption,
          instructionToMerchant,
          instructionToDeliveryAgent,
          voiceInstructionToMerchant: voiceInstructionToMerchantURL,
          voiceInstructionToDeliveryAgent: voiceInstructionToAgentURL,
          distance,
          startDate: scheduledDetails?.startDate || null,
          endDate: scheduledDetails?.endDate || null,
          time: scheduledDetails?.time || null,
          numOfDays: scheduledDetails?.numOfDays || null,
        },
        billDetail: {
          ...billDetail,
          deliveryChargePerDay: actualDeliveryCharge,
        },
      },
      { new: true, upsert: true }
    );

    res.status(200).json({ cartId: customerCart._id });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get cart bill
const getCartBillController = async (req, res, next) => {
  try {
    const { cartId } = req.query;

    const cartFound = await CustomerCart.findById(cartId).select("billDetail");

    res.status(200).json({ billDetail: cartFound.billDetail });
  } catch (err) {
    next(appError(err.message));
  }
};

// Apply Tip
const applyTipController = async (req, res, next) => {
  try {
    const { tip = 0 } = req.body;
    const customerId = req.userAuth;

    const cartFound = await CustomerCart.findOne({ customerId });
    if (!cartFound) return next(appError("Cart not found", 404));

    const { billDetail: cartBill } = cartFound;
    if (!cartBill) return next(appError("Billing details not found", 404));

    const oldTip = cartBill.addedTip || 0;

    const newTip = parseFloat(tip) || 0;
    cartBill.addedTip = newTip;

    // Recalculate totals with the new tip adjustment
    cartBill.subTotal += newTip - oldTip;
    cartBill.discountedGrandTotal += newTip - oldTip;
    cartBill.originalGrandTotal += newTip - oldTip;

    // Save the changes to the cart
    await cartFound.save();

    res.status(200).json(cartFound.billDetail);
  } catch (err) {
    next(appError(err.message));
  }
};

// Apply Promo code
const applyPromoCodeController = async (req, res, next) => {
  try {
    const { promoCode } = req.body;
    const customerId = req.userAuth;

    const [customerFound, cart] = await Promise.all([
      Customer.findById(customerId),
      CustomerCart.findOne({ customerId }),
    ]);

    if (!customerFound) return next(appError("Customer not found", 404));
    if (!cart) return next(appError("Cart not found", 404));

    // Find the promo code
    const promoCodeFound = await PromoCode.findOne({
      promoCode,
      geofenceId: customerFound.customerDetails.geofenceId,
      status: true,
      deliveryMode: cart.cartDetail.deliveryMode,
    });

    if (!promoCodeFound) {
      return next(appError("Promo code not found or inactive", 404));
    }

    // Check if promo code's merchant matches cart's merchant
    if (promoCodeFound.merchantId.toString() !== cart.merchantId.toString()) {
      return next(
        appError("Promo code is not applicable for this merchant", 400)
      );
    }

    const { itemTotal } = cart.billDetail;
    const totalCartPrice =
      cart.cartDetail.deliveryOption === "Scheduled"
        ? calculateScheduledCartValue(cart, promoCodeFound)
        : itemTotal;

    if (totalCartPrice < promoCodeFound.minOrderAmount) {
      return next(
        appError(
          `Minimum order amount is ${promoCodeFound.minOrderAmount}`,
          400
        )
      );
    }

    const now = new Date();
    if (now < promoCodeFound.fromDate || now > promoCodeFound.toDate) {
      return next(appError("Promo code is not valid at this time", 400));
    }

    if (promoCodeFound.noOfUserUsed >= promoCodeFound.maxAllowedUsers) {
      return next(appError("Promo code usage limit reached", 400));
    }

    const promoCodeDiscount = calculatePromoCodeDiscount(
      promoCodeFound,
      totalCartPrice
    );

    // Apply discount
    const updatedCart = applyPromoCodeDiscount(
      cart,
      promoCodeFound,
      promoCodeDiscount
    );

    await updatedCart.save();

    const populatedCart = await populateCartDetails(customerId);

    res.status(200).json({
      success: "Promo code applied successfully",
      data: populatedCart,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Order Product
const orderPaymentController = async (req, res, next) => {
  try {
    const { paymentMode } = req.body;
    const customerId = req.userAuth;

    const [customer, cart] = await Promise.all([
      Customer.findById(customerId),
      CustomerCart.findOne({ customerId })
        .populate({
          path: "items.productId",
          select: "productName productImageURL description variants",
        })
        .exec(),
    ]);

    if (!customer) return next(appError("Customer not found", 404));
    if (!cart) return next(appError("Cart not found", 404));

    const orderAmount =
      cart.billDetail.discountedGrandTotal ||
      cart.billDetail.originalGrandTotal;

    const merchant = await Merchant.findById(cart.merchantId);

    if (!merchant) return next(appError("Merchant not found", 404));

    const deliveryTimeMinutes = parseInt(
      merchant.merchantDetail.deliveryTime,
      10
    );

    const deliveryTime = new Date();
    deliveryTime.setMinutes(deliveryTime.getMinutes() + deliveryTimeMinutes);

    let startDate, endDate;
    if (cart.cartDetail.deliveryOption === "Scheduled") {
      startDate = new Date(cart.cartDetail.startDate);
      startDate.setHours(18, 30, 0, 0);

      endDate = new Date(cart.cartDetail.endDate);
      endDate.setHours(18, 29, 59, 999);
      s;
    }

    const populatedCartWithVariantNames = cart.toObject();
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

    const purchasedItems = await filterProductIdAndQuantity(
      populatedCartWithVariantNames.items
    );

    let formattedItems = populatedCartWithVariantNames.items.map((items) => {
      return {
        itemName: items.productId.productName,
        description: items.productId.description,
        itemImageURL: items.productId.productImageURL,
        quantity: items.quantity,
        price: items.price,
        variantTypeName: items?.variantTypeId?.variantTypeName,
      };
    });

    let orderBill = {
      deliveryChargePerDay: cart.billDetail.deliveryChargePerDay,
      deliveryCharge:
        cart.billDetail.discountedDeliveryCharge ||
        cart.billDetail.originalDeliveryCharge,
      taxAmount: cart.billDetail.taxAmount,
      discountedAmount: cart.billDetail.discountedAmount,
      grandTotal:
        cart.billDetail.discountedGrandTotal ||
        cart.billDetail.originalGrandTotal,
      itemTotal: cart.billDetail.itemTotal,
      addedTip: cart.billDetail.addedTip,
      subTotal: cart.billDetail.subTotal,
    };

    let walletTransaction = {
      closingBalance: customer?.customerDetails?.walletBalance,
      transactionAmount: orderAmount,
      date: new Date(),
      type: "Debit",
    };

    let customerTransaction = {
      madeOn: new Date(),
      transactionType: "Bill",
      transactionAmount: orderAmount,
      type: "Debit",
    };

    let newOrder;
    if (paymentMode === "Famto-cash") {
      if (customer.customerDetails.walletBalance < orderAmount) {
        return next(appError("Insufficient funds in wallet", 400));
      }

      // Deduct the amount from wallet
      customer.customerDetails.walletBalance -= orderAmount;

      // Format wallet balance to two decimal places
      customer.customerDetails.walletBalance = Number(
        customer.customerDetails.walletBalance.toFixed(2)
      );

      if (cart.cartDetail.deliveryOption === "Scheduled") {
        // Create a scheduled order

        newOrder = await ScheduledOrder.create({
          customerId,
          merchantId: cart.merchantId,
          items: formattedItems,
          orderDetail: cart.cartDetail,
          billDetail: orderBill,
          totalAmount: orderAmount,
          status: "Pending",
          paymentMode: "Famto-cash",
          paymentStatus: "Completed",
          startDate,
          endDate,
          time: cart.cartDetail.time,
          purchasedItems,
        });

        walletTransaction.orderId = newOrder._id;
        customer.walletTransactionDetail.push(walletTransaction);
        customer.transactionDetail.push(customerTransaction);

        await Promise.all([
          PromoCode.findOneAndUpdate(
            { promoCode: newOrder.billDetail.promoCodeUsed },
            { $inc: { noOfUserUsed: 1 } }
          ),
          customer.save(),
          CustomerCart.deleteOne({ customerId }),
        ]);

        res.status(200).json({
          message: "Scheduled order created successfully",
          data: newOrder,
        });
        return;
      } else {
        // Generate a unique order ID
        const orderId = new mongoose.Types.ObjectId();

        // Store order details temporarily in the database
        const tempOrder = await TemporaryOrder.create({
          orderId,
          customerId,
          merchantId: cart.merchantId,
          items: formattedItems,
          orderDetail: {
            ...cart.cartDetail,
            deliveryTime,
          },
          billDetail: orderBill,
          totalAmount: orderAmount,
          status: "Pending",
          paymentMode: "Famto-cash",
          paymentStatus: "Completed",
          purchasedItems,
        });

        // Clear the cart
        await CustomerCart.deleteOne({ customerId });

        if (!tempOrder) {
          return next(appError("Error in creating temporary order"));
        }

        // Return countdown timer to client
        res.status(200).json({
          message: "Custom order will be created in 1 minute.",
          orderId,
          countdown: 60,
        });

        // After 60 seconds, create the order if not canceled
        setTimeout(async () => {
          const storedOrderData = await TemporaryOrder.findOne({ orderId });

          if (storedOrderData) {
            let newOrderCreated = await Order.create({
              customerId: storedOrderData.customerId,
              merchantId: storedOrderData.merchantId,
              items: storedOrderData.items,
              orderDetail: storedOrderData.orderDetail,
              billDetail: storedOrderData.billDetail,
              totalAmount: storedOrderData.totalAmount,
              status: storedOrderData.status,
              paymentMode: storedOrderData.paymentMode,
              paymentStatus: storedOrderData.paymentStatus,
              purchasedItems: storedOrderData.purchasedItems,
              "orderDetailStepper.created": {
                by: storedOrderData.orderDetail.deliveryAddress.fullName,
                userId: storedOrderData.customerId,
                date: new Date(),
              },
            });

            if (!newOrder) return next(appError("Error in creating order"));

            const newOrder = await Order.findById(newOrderCreated._id).populate(
              "merchantId"
            );

            // Check if population was successful
            if (!newOrder.merchantId) {
              return next(
                appError("Error in populating order's merchant information")
              );
            }

            walletTransaction.orderId = newOrder._id;
            customer.walletTransactionDetail.push(walletTransaction);
            customer.transactionDetail.push(customerTransaction);

            await Promise.all([
              customer.save(),
              TemporaryOrder.deleteOne({ orderId }),
            ]);

            const eventName = "newOrderCreated";

            // Fetch notification settings to determine roles
            const notificationSettings = await NotificationSetting.findOne({
              event: eventName,
            });

            const rolesToNotify = [
              "admin",
              "merchant",
              "driver",
              "customer",
            ].filter((role) => notificationSettings[role]);

            // Send notifications to each role dynamically
            for (const role of rolesToNotify) {
              let roleId;

              if (role === "admin") {
                roleId = process.env.ADMIN_ID;
              } else if (role === "merchant") {
                roleId = newOrder?.merchantId._id;
              } else if (role === "driver") {
                roleId = newOrder?.agentId;
              } else if (role === "customer") {
                roleId = newOrder?.customerId;
              }

              if (roleId) {
                const notificationData = {
                  fcm: {
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

            const data = {
              title: notificationSettings.title,
              description: notificationSettings.description,

              orderId: newOrder._id,
              orderDetail: newOrder.orderDetail,
              billDetail: newOrder.billDetail,
              orderDetailStepper: newOrder.orderDetailStepper.created,

              //? Data for displaying detail in all orders table
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

            sendSocketData(newOrder.customerId, eventName, data);
            sendSocketData(newOrder.merchantId._id, eventName, data);
            sendSocketData(process.env.ADMIN_ID, eventName, data);
          }
        }, 60000);
      }
    } else if (paymentMode === "Cash-on-delivery") {
      if (cart.cartDetail.deliveryOption === "Scheduled") {
        return res.status(400).json({
          message: "Scheduled orders cannot be paid through Cash on delivery",
        });
      }

      // Generate a unique order ID
      const orderId = new mongoose.Types.ObjectId();

      // Store order details temporarily in the database
      const tempOrder = await TemporaryOrder.create({
        orderId,
        customerId,
        merchantId: cart.merchantId,
        items: formattedItems,
        orderDetail: {
          ...cart.cartDetail,
          deliveryTime,
        },
        billDetail: orderBill,
        totalAmount: orderAmount,
        status: "Pending",
        paymentMode: "Cash-on-delivery",
        paymentStatus: "Pending",
        purchasedItems,
      });

      customer.transactionDetail.push(customerTransaction);
      await customer.save();

      if (!tempOrder) {
        return next(appError("Error in creating temporary order"));
      }

      // Clear the cart
      await CustomerCart.deleteOne({ customerId });

      // Return countdown timer to client
      res.status(200).json({
        message: "Custom order will be created in 1 minute.",
        orderId,
        countdown: 60,
      });

      // After 60 seconds, create the order if not canceled
      setTimeout(async () => {
        const storedOrderData = await TemporaryOrder.findOne({ orderId });

        if (storedOrderData) {
          let newOrderCreated = await Order.create({
            customerId: storedOrderData?.customerId,
            merchantId: storedOrderData?.merchantId,
            items: storedOrderData?.items,
            orderDetail: storedOrderData?.orderDetail,
            billDetail: storedOrderData?.billDetail,
            totalAmount: storedOrderData?.totalAmount,
            status: storedOrderData?.status,
            paymentMode: storedOrderData?.paymentMode,
            paymentStatus: storedOrderData?.paymentStatus,
            purchasedItems: storedOrderData?.purchasedItems,
            "orderDetailStepper.created": {
              by: storedOrderData?.orderDetail?.deliveryAddress?.fullName,
              userId: storedOrderData?.customerId,
              date: new Date(),
            },
          });

          if (!newOrderCreated) {
            return next(appError("Error in creating order"));
          }

          const newOrder = await Order.findById(newOrderCreated._id).populate(
            "merchantId"
          );

          // Check if population was successful
          if (!newOrder.merchantId) {
            return next(
              appError("Error in populating order's merchant information")
            );
          }

          // Remove the temporary order data from the database
          await TemporaryOrder.deleteOne({ orderId });

          const eventName = "newOrderCreated";

          // Fetch notification settings to determine roles
          const notificationSettings = await NotificationSetting.findOne({
            event: eventName,
          });

          const rolesToNotify = [
            "admin",
            "merchant",
            "driver",
            "customer",
          ].filter((role) => notificationSettings[role]);

          // Send notifications to each role dynamically
          for (const role of rolesToNotify) {
            let roleId;

            if (role === "admin") {
              roleId = process.env.ADMIN_ID;
            } else if (role === "merchant") {
              roleId = newOrder?.merchantId._id;
            } else if (role === "driver") {
              roleId = newOrder?.agentId;
            } else if (role === "customer") {
              roleId = newOrder?.customerId;
            }

            if (roleId) {
              const notificationData = {
                fcm: {
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

          const data = {
            title: notificationSettings.title,
            description: notificationSettings.description,

            orderId: newOrder._id,
            orderDetail: newOrder.orderDetail,
            billDetail: newOrder.billDetail,
            orderDetailStepper: newOrder.orderDetailStepper.created,

            //? Data for displaying detail in all orders table
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

          sendSocketData(newOrder.customerId, eventName, data);
          sendSocketData(newOrder.merchantId._id, eventName, data);
          sendSocketData(process.env.ADMIN_ID, eventName, data);
        }
      }, 60000);
    } else if (paymentMode === "Online-payment") {
      const { success, orderId, error } = await createRazorpayOrderId(
        orderAmount
      );

      if (!success) {
        return next(
          appError(`Error in creating Razorpay order: ${error}`, 500)
        );
      }

      res.status(200).json({ success: true, orderId, amount: orderAmount });
      return;
    } else {
      return next(appError("Invalid payment mode", 400));
    }
  } catch (err) {
    next(appError(err.message));
  }
};

// Verify online payment
const verifyOnlinePaymentController = async (req, res, next) => {
  try {
    const { paymentDetails } = req.body;
    const customerId = req.userAuth;

    if (!customerId) {
      return next(appError("Customer is not authenticated", 401));
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return next(appError("Customer not found", 404));
    }

    const cart = await CustomerCart.findOne({ customerId })
      .populate({
        path: "items.productId",
        select: "productName productImageURL description variants",
      })
      .exec();

    if (!cart) {
      return next(appError("Cart not found", 404));
    }

    const isPaymentValid = await verifyPayment(paymentDetails);
    if (!isPaymentValid) {
      return next(appError("Invalid payment", 400));
    }

    const merchant = await Merchant.findById(cart.merchantId);

    if (!merchant) {
      return next(appError("Merchant not found", 404));
    }

    const populatedCartWithVariantNames = cart.toObject();
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
            _id: product._id,
            productName: product.productName,
            description: product.description,
            productImageURL: product.productImageURL,
          },
          variantTypeId: variantTypeData,
        };
      });

    const purchasedItems = await filterProductIdAndQuantity(
      populatedCartWithVariantNames.items
    );

    let formattedItems = populatedCartWithVariantNames.items.map((items) => {
      return {
        itemName: items?.productId?.productName,
        description: items?.productId?.description,
        itemImageURL: items?.productId?.productImageURL,
        quantity: items?.quantity,
        price: items?.price,
        variantTypeName: items?.variantTypeId?.variantTypeName,
      };
    });

    const orderAmount =
      cart.billDetail.discountedGrandTotal ||
      cart.billDetail.originalGrandTotal;

    let startDate, endDate;
    if (cart.cartDetail.deliveryOption === "Scheduled") {
      startDate = new Date(cart.cartDetail.startDate);
      startDate.setHours(18, 30, 0, 0);

      endDate = new Date(cart.cartDetail.startDate);
      endDate.setHours(18, 29, 59, 999);
    }

    let orderBill = {
      deliveryChargePerDay: cart.billDetail.deliveryChargePerDay,
      deliveryCharge:
        cart.billDetail.discountedDeliveryCharge ||
        cart.billDetail.originalDeliveryCharge,
      taxAmount: cart.billDetail.taxAmount,
      discountedAmount: cart.billDetail.discountedAmount,
      grandTotal:
        cart.billDetail.discountedGrandTotal ||
        cart.billDetail.originalGrandTotal,
      itemTotal: cart.billDetail.itemTotal,
      addedTip: cart.billDetail.addedTip,
      subTotal: cart.billDetail.subTotal,
    };

    let customerTransaction = {
      madeOn: new Date(),
      transactionType: "Bill",
      transactionAmount: orderAmount,
      type: "Debit",
    };

    const deliveryTimeMinutes = parseInt(
      merchant.merchantDetail.deliveryTime,
      10
    );

    const deliveryTime = new Date();
    deliveryTime.setMinutes(deliveryTime.getMinutes() + deliveryTimeMinutes);

    let newOrder;
    // Check if the order is scheduled
    if (cart.cartDetail.deliveryOption === "Scheduled") {
      // Create a scheduled order
      newOrder = await ScheduledOrder.create({
        customerId,
        merchantId: cart.merchantId,
        items: formattedItems,
        orderDetail: cart.cartDetail,
        billDetail: orderBill,
        totalAmount: orderAmount,
        status: "Pending",
        paymentMode: "Online-payment",
        paymentStatus: "Completed",
        startDate, //cart.cartDetail.startDate,
        endDate, //: cart.cartDetails.endDate,
        time: cart.cartDetail.time,
        paymentId: paymentDetails.razorpay_payment_id,
        purchasedItems,
      });

      // Clear the cart
      await CustomerCart.deleteOne({ customerId });

      customer.transactionDetail.push(customerTransaction);
      await customer.save();

      res.status(200).json({
        message: "Scheduled order created successfully",
        data: newOrder,
      });
      return;
    } else {
      // Generate a unique order ID
      const orderId = new mongoose.Types.ObjectId();

      // Store order details temporarily in the database
      const tempOrder = await TemporaryOrder.create({
        orderId,
        customerId,
        merchantId: cart.merchantId,
        items: formattedItems,
        orderDetail: {
          ...cart.cartDetail,
          deliveryTime,
        },
        billDetail: orderBill,
        totalAmount: orderAmount,
        status: "Pending",
        paymentMode: "Online-payment",
        paymentStatus: "Completed",
        paymentId: paymentDetails.razorpay_payment_id,
        purchasedItems,
      });

      customer.transactionDetail.push(customerTransaction);
      await customer.save();

      if (!tempOrder) {
        return next(appError("Error in creating temporary order"));
      }

      await CustomerCart.deleteOne({ customerId });

      // Return countdown timer to client
      res.status(200).json({
        message: "Order will be created in 1 minute.",
        orderId,
        countdown: 60,
      });

      // After 60 seconds, create the order if not canceled
      setTimeout(async () => {
        const storedOrderData = await TemporaryOrder.findOne({ orderId });

        if (storedOrderData) {
          let newOrderCreated = await Order.create({
            customerId: storedOrderData.customerId,
            items: storedOrderData.items,
            orderDetail: storedOrderData.orderDetail,
            billDetail: storedOrderData.billDetail,
            totalAmount: storedOrderData.totalAmount,
            status: storedOrderData.status,
            paymentMode: storedOrderData.paymentMode,
            paymentStatus: storedOrderData.paymentStatus,
            purchasedItems: storedOrderData.purchasedItems,
            "orderDetailStepper.created": {
              by: storedOrderData.orderDetail.deliveryAddress.fullName,
              userId: storedOrderData.customerId,
              date: new Date(),
            },
          });

          if (!newOrderCreated) {
            return next(appError("Error in creating order"));
          }

          const newOrder = await Order.findById(newOrderCreated._id).populate(
            "merchantId"
          );

          // Check if population was successful
          if (!newOrder.merchantId) {
            return next(
              appError("Error in populating order's merchant information")
            );
          }

          // Remove the temporary order data from the database
          await TemporaryOrder.deleteOne({ orderId });

          const eventName = "newOrderCreated";

          // Fetch notification settings to determine roles
          const notificationSettings = await NotificationSetting.findOne({
            event: eventName,
          });

          const rolesToNotify = [
            "admin",
            "merchant",
            "driver",
            "customer",
          ].filter((role) => notificationSettings[role]);

          // Send notifications to each role dynamically
          for (const role of rolesToNotify) {
            let roleId;

            if (role === "admin") {
              roleId = process.env.ADMIN_ID;
            } else if (role === "merchant") {
              roleId = newOrder?.merchantId._id;
            } else if (role === "driver") {
              roleId = newOrder?.agentId;
            } else if (role === "customer") {
              roleId = newOrder?.customerId;
            }

            if (roleId) {
              const notificationData = {
                fcm: {
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

          const data = {
            title: notificationSettings.title,
            description: notificationSettings.description,

            orderId: newOrder._id,
            orderDetail: newOrder.orderDetail,
            billDetail: newOrder.billDetail,
            orderDetailStepper: newOrder.orderDetailStepper.created,

            //? Data for displaying detail in all orders table
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

          sendSocketData(newOrder.customerId, eventName, data);
          sendSocketData(newOrder.merchantId._id, eventName, data);
          sendSocketData(process.env.ADMIN_ID, eventName, data);
        }
      }, 60000);
    }
  } catch (err) {
    next(appError(err.message));
  }
};

// Cancel order before getting created
const cancelOrderBeforeCreationController = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const orderFound = await TemporaryOrder.findOne({ orderId });

    const customerFound = await Customer.findById(orderFound.customerId);

    let updatedTransactionDetail = {
      transactionType: "Refund",
      madeOn: new Date(),
      type: "Credit",
    };

    if (orderFound) {
      if (orderFound.paymentMode === "Famto-cash") {
        const orderAmount = orderFound.billDetail.grandTotal;
        if (orderFound.orderDetail.deliveryOption === "On-demand") {
          customerFound.customerDetails.walletBalance += orderAmount;
          updatedTransactionDetail.transactionAmount = orderAmount;
        }

        // Remove the temporary order data from the database
        await TemporaryOrder.deleteOne({ orderId });

        customerFound.transactionDetail.push(updatedTransactionDetail);

        await customerFound.save();

        res.status(200).json({
          message: "Order cancelled",
        });
        return;
      } else if (orderFound.paymentMode === "Cash-on-delivery") {
        // Remove the temporary order data from the database
        await TemporaryOrder.deleteOne({ orderId });

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

        customerFound.transactionDetail.push(updatedTransactionDetail);

        await customerFound.save();

        res.status(200).json({
          message: "Order cancelled",
        });
        return;
      }
    } else {
      res.status(400).json({
        message: "Order creation already processed or not found",
      });
    }
  } catch (err) {
    next(appError(err.message));
  }
};

// Clear cart
const clearCartController = async (req, res, next) => {
  try {
    const { cartId } = req.params;

    const deleteResult = await CustomerCart.deleteOne({
      _id: cartId,
      customerId: req.userAuth,
    });

    if (deleteResult.deletedCount === 0) {
      return next(appError("Cart not found", 404));
    }

    res.status(200).json({ message: "Cart cleared" });
  } catch (err) {
    next(appError(err.message));
  }
};

const getOrderTrackingDetail = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const [order, task] = await Promise.all([
      Order.findById(orderId).populate("merchantId"),
      Task.findOne({ orderId }).populate("agentId"),
    ]);

    const lastUpdatedShop = order?.detailAddedByAgent?.shopUpdate?.splice(-1);

    const formattedResponse = {
      pickupLocation:
        lastUpdatedShop?.location || order?.orderDetail?.pickupLocation || [],
      deliveryLocation: order?.orderDetail?.deliveryLocation,
      deliveryMode: order?.orderDetail?.deliveryMode,
      agentId: task?.agentId?._id || null,
      agentName: task?.agentId?.fullName || null,
      agentImage: task?.agentId?.agentImageURL || null,
      agentPhone: task?.agentId?.phoneNumber || null,
      merchantId: order?.merchantId?._id || null,
      merchantName: order?.merchantId?.merchantDetail?.merchantName || null,
      merchantPhone: order?.merchantId?.phoneNumber || null,
      deliveryTime: formatTime(order?.orderDetail?.deliveryTime),
      orderCreatedStatus: {
        status: true,
        time: formatTime(order.createdAt),
      },
      inTransit:
        task.pickupDetail.pickupStatus === "Started" ||
        task.pickupDetail.pickupStatus === "Completed" ||
        task.deliveryDetail.deliveryStatus === "Started" ||
        task.deliveryDetail.deliveryStatus === "Completed"
          ? true
          : false,
      completeStatus: order.status === "Completed" ? true : false,
    };

    res.status(200).json(formattedResponse);
  } catch (err) {
    next(appError(err.message));
  }
};

const getOrderTrackingStepper = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const [order, task] = await Promise.all([
      Order.findById(orderId).populate("merchantId"),
      Task.findOne({ orderId }).populate("agentId"),
    ]);

    const formattedResponse = {
      deliveryTime: formatTime(order.orderDetail.deliveryTime),
      createdAt: true,
      createAt: formatTime(order.createdAt),
      acceptedByAgent: task.taskStatus === "Assigned" ? true : false,
      acceptedAt: formatTime(order.orderDetail.agentAcceptedAt),
      reachedPickupLocation:
        task.pickupDetail.pickupStatus === "Completed" ? true : false,
      reachedPickupLocationAt: formatTime(task?.pickupDetail?.completedTime),
      pickedByAgent:
        task.deliveryDetail.deliveryStatus !== "Accepted" ? true : false,
      pickedByAgentAt: formatTime(task?.deliveryDetail?.startTime),
      noteStatus: order?.detailAddedByAgent?.notes ? true : false,
      note: order?.detailAddedByAgent?.notes || null,
      signatureStatus: order?.detailAddedByAgent?.signatureImageURL
        ? true
        : false,
      signature: order?.detailAddedByAgent?.signatureImageURL || null,
      imageURLStatus: order?.detailAddedByAgent?.imageURL ? true : false,
      imageURL: order?.detailAddedByAgent?.imageURL || null,
      billStatus: true,
      billDetail: order?.billDetail,
      orderCompletedStatus: order.status === "Completed" ? true : false,
    };

    res.status(200).json(formattedResponse);
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  getAllBusinessCategoryController,
  homeSearchController,
  listRestaurantsController,
  getAllCategoriesOfMerchants,
  getAllProductsOfMerchantController,
  getProductVariantsByProductIdController,
  filterAndSearchMerchantController,
  filterAndSortAndSearchProductsController,
  toggleProductFavoriteController,
  toggleMerchantFavoriteController,
  addRatingToMerchantController,
  getTotalRatingOfMerchantController,
  addOrUpdateCartItemController,
  getDeliveryOptionOfMerchantController,
  applyPromoCodeController,
  orderPaymentController,
  verifyOnlinePaymentController,
  cancelOrderBeforeCreationController,
  clearCartController,
  applyTipController,
  confirmOrderDetailController,
  getCartBillController,
  getOrderTrackingDetail,
  getOrderTrackingStepper,
  searchProductsInMerchantToOrderController,
};
