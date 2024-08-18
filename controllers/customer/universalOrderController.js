const appError = require("../../utils/appError");
const turf = require("@turf/turf");
const Customer = require("../../models/Customer");
const Product = require("../../models/Product");
const { validationResult } = require("express-validator");
const BusinessCategory = require("../../models/BusinessCategory");
const Merchant = require("../../models/Merchant");
const Category = require("../../models/Category");
const {
  sortMerchantsBySponsorship,
  getDistanceFromPickupToDelivery,
  getTaxAmount,
  getDeliveryAndSurgeCharge,
  calculateDiscountedPrice,
} = require("../../utils/customerAppHelpers");
const CustomerCart = require("../../models/CustomerCart");
const mongoose = require("mongoose");
const PromoCode = require("../../models/PromoCode");
const {
  createRazorpayOrderId,
  verifyPayment,
  razorpayRefund,
} = require("../../utils/razorpayPayment");
const Order = require("../../models/Order");
const ScheduledOrder = require("../../models/ScheduledOrder");
const { convertToUTC } = require("../../utils/formatters");
const SubscriptionLog = require("../../models/SubscriptionLog");
const {
  deleteFromFirebase,
  uploadToFirebase,
} = require("../../utils/imageOperation");
const TemperoryOrder = require("../../models/TemperoryOrders");
const geoLocation = require("../../utils/getGeoLocation");

// Get all available business categories according to the order
const getAllBusinessCategoryController = async (req, res, next) => {
  try {
    const allBusinessCategories = await BusinessCategory.find({ status: true })
      .select("title bannerImageURL")
      .sort({ order: 1 });

    res.status(200).json({
      message: "All business categories",
      data: allBusinessCategories,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// search for Product OR Business category OR Merchant in the home
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
      title: { $regex: query, $options: "i" }, // Case-insensitive search
    })
      .select("title bannerImageURL")
      .exec();

    // Search in Product by productName or searchTags
    const products = await Product.find({
      $or: [
        { productName: { $regex: query, $options: "i" } },
        { searchTags: { $in: [query] } },
      ],
    })
      .select("productName productImageURL type, price")
      .exec();

    // Search in Merchant by merchantName
    const merchants = await Merchant.find({
      "merchantDetail.merchantName": { $regex: query, $options: "i" },
      "merchantDetail.pricing.0": { $exists: true },
    })
      .select(
        "merchantDetail.merchantName merchantDetail.merchantImageURL merchantDetail.displayAddress"
      )
      .exec();

    // Combine results from all models
    const searchResults = {
      businessCategories,
      products,
      merchants: merchants.map((merchant) => ({
        _id: merchant._id,
        merchantName: merchant.merchantDetail.merchantName,
        merchantImageURL: merchant.merchantDetail.merchantImageURL,
        displayAddress: merchant.merchantDetail.displayAddress,
      })),
    };

    res.status(200).json({
      message: "Search results",
      data: searchResults,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// List the available restaurants in the customers geofence
const listRestaurantsController = async (req, res, next) => {
  const { latitude, longitude, customerId, businessCategoryId } = req.body;

  try {
    // Fetch the authenticated customer to get their favorite merchants, if they exist
    let currentCustomer = null;
    if (customerId) {
      currentCustomer = await Customer.findById(customerId)
        .select("customerDetails.favoriteMerchants")
        .exec();
    }

    const customerLocation = [latitude, longitude]; // [latitude, longitude]

    const foundGeofence = await geoLocation(latitude, longitude, next);

    if (!foundGeofence) {
      return next(appError("Geofence not found", 404));
    }

    // Query merchants based on geofence and other conditions
    const merchants = await Merchant.find({
      "merchantDetail.geofenceId": foundGeofence._id,
      "merchantDetail.businessCategoryId": businessCategoryId,
      "merchantDetail.pricing.0": { $exists: true },
      isBlocked: false,
      isApproved: "Approved",
    }).exec();

    // Filter merchants based on serving radius
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

    // Sort merchants by sponsorship status (sponsored merchants first)
    const sortedMerchants = await sortMerchantsBySponsorship(filteredMerchants);

    // Extracting required fields from filtered merchants including distance and favorite status
    const simplifiedMerchants = await Promise.all(
      sortedMerchants.map(async (merchant) => {
        const merchantLocation = merchant.merchantDetail.location;
        const { distanceInKM } = await getDistanceFromPickupToDelivery(
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
          distanceInKM: parseFloat(distanceInKM),
          restaurantType: merchant.merchantDetail.merchantFoodType || "-",
          merchantImageURL: merchant.merchantDetail.merchantImageURL,
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

// Get all the availble categories and products of a merchant
const getMerchantWithCategoriesAndProductsController = async (
  req,
  res,
  next
) => {
  try {
    const { merchantId, customerId } = req.params;

    const merchantFound = await Merchant.findOne({
      _id: merchantId,
      isApproved: "Approved",
    });

    if (!merchantFound) {
      return next(appError("Merchant not found", 404));
    }

    let currentCustomer = null;
    if (customerId) {
      currentCustomer = await Customer.findById(customerId)
        .select("customerDetails.favoriteProducts")
        .exec();
    }

    const categoriesOfMerchant = await Category.find({ merchantId })
      .select("_id categoryName status")
      .sort({ order: 1 });

    const categoriesWithProducts = await Promise.all(
      categoriesOfMerchant.map(async (category) => {
        const products = await Product.find({ categoryId: category._id })
          .populate(
            "discountId",
            "discountName maxAmount discountType discountValue validFrom validTo onAddOn status"
          )
          .select(
            "_id productName price description productImageURL inventory variants discountId"
          )
          .sort({ order: 1 });

        const productsWithDetails = products.map((product) => {
          const currentDate = new Date();
          const validFrom = new Date(product?.discountId?.validFrom);
          const validTo = new Date(product?.discountId?.validTo);

          // Adjusting the validTo date to the end of the day
          validTo?.setHours(23, 59, 59, 999);

          let discountPrice = product.price;
          let variantsWithDiscount = product?.variants;

          if (
            product?.discountId &&
            validFrom <= currentDate &&
            validTo >= currentDate &&
            product?.discountId?.status
          ) {
            const discount = product.discountId;

            if (discount.discountType === "Percentage-discount") {
              let discountAmount =
                (product.price * discount.discountValue) / 100;
              if (discountAmount > discount.maxAmount) {
                discountAmount = discount.maxAmount;
              }
              discountPrice -= discountAmount;
            } else if (discount.discountType === "Flat-discount") {
              discountPrice -= discount.discountValue;
            }

            if (discountPrice < 0) discountPrice = 0;

            // Apply discount to the variants if onAddOn is true
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
                      variantDiscountPrice -= discountAmount;
                    } else if (discount.discountType === "Flat-discount") {
                      variantDiscountPrice -= discount.discountValue;
                    }

                    if (variantDiscountPrice < 0) variantDiscountPrice = 0;

                    return {
                      ...variantType._doc,
                      discountPrice: variantDiscountPrice,
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

          const isFavorite =
            currentCustomer?.customerDetails?.favoriteProducts?.includes(
              product._id
            ) ?? false;

          return {
            ...product._doc,
            isFavorite,
            discountPrice,
            variants: variantsWithDiscount,
          };
        });

        return {
          ...category._doc,
          products: productsWithDetails,
        };
      })
    );

    const formattedResponse = {
      merchant: {
        _id: merchantFound.id,
        phoneNumber: merchantFound.phoneNumber || "-",
        FSSAINumber: merchantFound.merchantDetail?.FSSAINumber || "-",
        merchantName: merchantFound.merchantDetail?.merchantName || "-",
        deliveryTime: merchantFound.merchantDetail?.deliveryTime || "-",
        description: merchantFound.merchantDetail?.description || "-",
        displayAddress: merchantFound.merchantDetail?.displayAddress || "-",
        merchantImageURL:
          merchantFound?.merchantDetail?.merchantImageURL || "-",
      },
      categories: categoriesWithProducts,
    };

    res.status(200).json({
      message: "Categories and products of merchant",
      data: formattedResponse,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Filter merchants based on (Pure veg, Rating, Nearby)
const filterMerchantController = async (req, res, next) => {
  try {
    const { filterType, latitude, longitude } = req.body;

    // Define filter criteria based on filter type
    let filterCriteria = {
      isBlocked: false,
      isApproved: "Approved",
      "merchantDetail.pricing.0": { $exists: true },
    };

    if (filterType === "Veg") {
      filterCriteria["merchantDetail.merchantFoodType"] = { $in: ["Veg"] };
    } else if (filterType === "Rating") {
      filterCriteria["merchantDetail.averageRating"] = { $gte: 4.0 };
    }

    let merchants = await Merchant.find(filterCriteria).exec();

    if (filterType === "Nearby") {
      if (!latitude || !longitude) {
        return next(
          appError("Latitude and longitude are required for nearby filter", 400)
        );
      }

      const customerLocation = [latitude, longitude];
      merchants = merchants.filter((merchant) => {
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
    }

    const sortedMerchants = sortMerchantsBySponsorship(merchants);

    const responseMerchants = sortedMerchants.map((merchant) => {
      const merchantLocation = merchant.merchantDetail.location;
      const distance = turf.distance(
        turf.point(merchantLocation),
        turf.point([latitude, longitude]),
        { units: "kilometers" }
      );

      return {
        _id: merchant._id,
        merchantName: merchant.merchantDetail.merchantName,
        averageRating: merchant.merchantDetail.averageRating,
        merchantImageURL: merchant.merchantDetail.merchantImageURL,
        description: merchant.merchantDetail.description,
        deliveryTime: merchant.merchantDetail.deliveryTime,
        displayAddress: merchant.merchantDetail.displayAddress,
        merchantFoodType: merchant.merchantDetail.merchantFoodType,
        distance: distance.toFixed(2),
      };
    });

    res.status(200).json({
      message: "Filtered merchants",
      data: responseMerchants,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Search for a product in the merchant
const searchProductsInMerchantController = async (req, res, next) => {
  try {
    const { merchantId } = req.params;

    const { query } = req.query;

    // Find categories belonging to the merchant
    const categories = await Category.find({ merchantId });

    // Extract category IDs
    const categoryIds = categories.map((category) => category._id);

    // Search products by name or description within the categories
    const products = await Product.find({
      categoryId: { $in: categoryIds },
      $or: [
        { productName: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } },
        { searchTags: { $in: [query] } },
      ],
    })
      .select("_id productName price description inventory variants")
      .sort({ order: 1 });

    res.status(200).json({
      message: "Products found in merchant",
      data: products,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Filter and sort products
const filterAndSortProductsController = async (req, res, next) => {
  try {
    const { merchantId } = req.params;
    const { filter, sort } = req.query;

    // Get category IDs associated with the merchant
    const categories = await Category.find({ merchantId }).select("_id");

    const categoryIds = categories.map((category) => category._id);

    // Build the query object
    let query = { categoryId: { $in: categoryIds } };

    // Add filter conditions
    if (filter) {
      if (filter === "Veg" || filter === "Non-veg") {
        query.type = filter;
      } else if (filter === "Favorite") {
        const customer = await Customer.findOne({
          "customerDetails.favoriteProducts": {
            $exists: true,
            $not: { $size: 0 },
          },
        }).select("customerDetails.favoriteProducts");
        if (customer) {
          query._id = { $in: customer.customerDetails.favoriteProducts };
        } else {
          query._id = { $in: [] }; // No favorite products found, return empty result
        }
      }
    }

    // Build the sort object
    let sortObj = {};
    if (sort) {
      if (sort === "Price - low to high") {
        sortObj.price = 1; // Ascending order
      } else if (sort === "Price - high to low") {
        sortObj.price = -1; // Descending order
      }
    }

    // Fetch the filtered and sorted products
    const products = await Product.find(query)
      .select(
        "productName price longDescription productImageURL inventory variants"
      )
      .sort(sortObj);

    res.status(200).json({
      message: "Filtered and sorted products retrieved successfully",
      products,
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
        return res
          .status(400)
          .json({ error: "VariantType not found for this product" });
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
      finalPrice = variant ? variant.discountPrice : discountPrice;
    }

    let cart = await CustomerCart.findOne({ customerId });

    if (cart) {
      if (!cart.merchantId === merchantId) {
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
        console.log("New Item", newItem);
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
      return res
        .status(200)
        .json({ message: "Cart is empty and has been deleted" });
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
      }
    );

    res.status(200).json({
      success: "Cart updated successfully",
      data: {
        ...updatedCartWithVariantNames,
        itemTotal: updatedCart.itemTotal,
      },
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Add Cart details (Address, Tip, Instrunctions)
const addCartDetailsController = async (req, res, next) => {
  try {
    const {
      addressType,
      otherAddressId,
      fullName,
      phoneNumber,
      flat,
      area,
      landmark,
      coordinates,
      addToAddressBook,
      deliveryMode,
      instructionToMerchant,
      instructionToDeliveryAgent,
      addedTip = 0,
      startDate,
      endDate,
      time,
    } = req.body;

    const customerId = req.userAuth;

    if (!customerId) {
      return next(appError("Customer is not authenticated", 401));
    }

    const customer = await Customer.findById(customerId);

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // Retrieve the specified address coordinates from the customer data
    let deliveryCoordinates;
    let deliveryAddress = {};

    if (deliveryMode === "Home Delivery") {
      if (fullName && phoneNumber && flat && area && coordinates) {
        deliveryAddress = {
          fullName,
          phoneNumber,
          flat,
          area,
          landmark,
        };

        deliveryCoordinates = coordinates;

        if (addToAddressBook) {
          if (addressType === "home") {
            customer.customerDetails.homeAddress = deliveryAddress;
            customer.customerDetails.homeAddress.coordinates =
              deliveryCoordinates;
          } else if (addressType === "work") {
            customer.customerDetails.workAddress = deliveryAddress;
            customer.customerDetails.workAddress.coordinates =
              deliveryCoordinates;
          } else if (addressType === "other") {
            customer.customerDetails.otherAddress.push({
              id: new mongoose.Types.ObjectId(),
              coordinates: deliveryCoordinates,
              ...deliveryAddress,
            });
          }

          await customer.save();
        }
      } else {
        if (addressType === "home") {
          deliveryCoordinates =
            customer.customerDetails.homeAddress.coordinates;
          deliveryAddress = { ...customer.customerDetails.homeAddress };
        } else if (addressType === "work") {
          deliveryCoordinates =
            customer.customerDetails.workAddress.coordinates;
          deliveryAddress = { ...customer.customerDetails.workAddress };
        } else {
          const otherAddress = customer.customerDetails.otherAddress.find(
            (addr) => addr.id.toString() === otherAddressId
          );
          if (otherAddress) {
            deliveryCoordinates = otherAddress.coordinates;
            deliveryAddress = { ...otherAddress };
          } else {
            return res.status(404).json({ error: "Address not found" });
          }
        }
      }
    }

    const cart = await CustomerCart.findOne({ customerId });

    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }

    const merchant = await Merchant.findById(cart.merchantId);

    if (!merchant) {
      return res.status(404).json({ error: "Merchant not found" });
    }

    const pickupCoordinates = merchant.merchantDetail.location;

    // Calculate itemTotal in the controller
    const itemTotal = cart.items.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );

    let voiceInstructiontoMerchantURL =
      cart?.cartDetail?.voiceInstructiontoMerchant || "";
    let voiceInstructiontoAgentURL =
      cart?.cartDetail?.voiceInstructiontoAgent || "";

    if (req.files) {
      const { voiceInstructiontoMerchant, voiceInstructiontoAgent } = req.files;

      if (req.files.voiceInstructiontoMerchant) {
        if (voiceInstructiontoMerchantURL) {
          await deleteFromFirebase(voiceInstructiontoMerchantURL);
        }
        voiceInstructiontoMerchantURL = await uploadToFirebase(
          voiceInstructiontoMerchant,
          "VoiceInstructions"
        );
      }

      if (req.files.voiceInstructiontoAgent) {
        if (voiceInstructiontoAgentURL) {
          await deleteFromFirebase(voiceInstructiontoAgentURL);
        }
        voiceInstructiontoAgentURL = await uploadToFirebase(
          voiceInstructiontoAgent,
          "VoiceInstructions"
        );
      }
    }

    let updatedCartDetail = {
      pickupLocation: pickupCoordinates,
      pickupAddress: {
        fullName: merchant.merchantDetail.merchantName,
        area: merchant.merchantDetail.displayAddress,
        phoneNumber: merchant.phoneNumber,
      },
      deliveryMode,
      deliveryOption: startDate && endDate && time ? "Scheduled" : "On-demand",
      instructionToMerchant,
      instructionToDeliveryAgent,
      voiceInstructiontoMerchant: voiceInstructiontoMerchantURL,
      voiceInstructiontoAgent: voiceInstructiontoAgentURL,
      startDate,
      endDate,
      time: time && convertToUTC(time),
    };

    const subscriptionOfCustomer = await Customer.findById(customerId).select(
      "customerDetails.pricing"
    );

    let discountedAmount = 0;
    if (subscriptionOfCustomer?.customerDetails?.pricing?.length > 0) {
      const subscriptionLog = await SubscriptionLog.findById(
        subscriptionOfCustomer.customerDetails.pricing[0]
      );

      const now = new Date();

      if (
        (new Date(subscriptionLog.startDate) < now ||
          new Date(subscriptionLog.endDate) > now) &&
        subscriptionLog.currentNumberOfOrders < subscriptionLog.maxOrders
      ) {
        discountedAmount = subscriptionLog.amount;
        // TODO: Increase the count
      }
    }

    let updatedBill = {
      addedTip,
      itemTotal: parseFloat(itemTotal).toFixed(2),
      discountedAmount: discountedAmount || null,
    };

    let subTotal;

    if (deliveryMode === "Take Away") {
      updatedCartDetail = {
        ...updatedCartDetail,
        deliveryLocation: pickupCoordinates,
        distance: 0,
      };

      if (startDate && endDate && time) {
        const startDateTime = new Date(`${startDate} ${time}`);
        const endDateTime = new Date(`${endDate} ${time}`);

        const diffTime = Math.abs(endDateTime - startDateTime);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        // Set subTotal, originalGrandTotal without tax and delivery charges
        subTotal =
          itemTotal * diffDays +
          parseFloat(addedTip) -
          parseFloat(discountedAmount);

        updatedBill.originalGrandTotal = parseFloat(subTotal).toFixed(2);
        updatedBill.taxAmount = 0;
        updatedBill.originalDeliveryCharge = 0;

        cart.cartDetail = updatedCartDetail;
      } else {
        // Set originalGrandTotal without tax and delivery charges
        updatedBill.originalGrandTotal = parseFloat(itemTotal).toFixed(2);
        updatedBill.taxAmount = 0;
        updatedBill.originalDeliveryCharge = 0;

        cart.cartDetail = updatedCartDetail;

        subTotal =
          itemTotal + parseFloat(addedTip) - parseFloat(discountedAmount);
      }
    } else {
      updatedCartDetail = {
        ...updatedCartDetail,
        deliveryLocation: deliveryCoordinates,
        deliveryAddress,
        distance: 0,
      };

      // Calculate distance using MapMyIndia API
      const { distanceInKM } = await getDistanceFromPickupToDelivery(
        pickupCoordinates,
        deliveryCoordinates
      );

      updatedCartDetail.distance = distanceInKM;

      const businessCategoryId = merchant.merchantDetail.businessCategoryId;

      const { deliveryCharges, surgeCharges } = await getDeliveryAndSurgeCharge(
        customerId,
        "Home Delivery",
        distanceInKM,
        businessCategoryId
      );

      updatedBill.surgeCharges = surgeCharges;

      if (startDate && endDate) {
        const startDateTime = new Date(`${startDate} ${time}`);
        const endDateTime = new Date(`${endDate} ${time}`);

        const diffTime = Math.abs(endDateTime - startDateTime);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        const scheduledDeliveryCharge = (deliveryCharges * diffDays).toFixed(2);
        const cartTotal = (itemTotal * diffDays).toFixed(2);

        updatedBill.originalDeliveryCharge = scheduledDeliveryCharge;
        updatedBill.deliveryChargePerDay = deliveryCharges;
        updatedCartDetail.numOfDays = diffDays;

        // Update the itemTotal with multiplied value
        updatedBill.itemTotal = parseFloat(cartTotal);

        const taxAmount = await getTaxAmount(
          businessCategoryId,
          merchant.merchantDetail.geofenceId,
          parseFloat(cartTotal),
          parseFloat(scheduledDeliveryCharge)
        );

        updatedBill.taxAmount = taxAmount.toFixed(2);

        const grandTotal = (
          parseFloat(cartTotal) +
          parseFloat(scheduledDeliveryCharge) +
          parseFloat(addedTip) +
          parseFloat(taxAmount) -
          parseFloat(discountedAmount)
        ).toFixed(2);

        updatedBill.originalGrandTotal = parseFloat(grandTotal);
        subTotal =
          parseFloat(itemTotal) * diffDays +
          parseFloat(scheduledDeliveryCharge) +
          parseFloat(addedTip) -
          parseFloat(discountedAmount);
      } else {
        updatedBill.originalDeliveryCharge = deliveryCharges.toFixed(2);

        const taxAmount = await getTaxAmount(
          businessCategoryId,
          merchant.merchantDetail.geofenceId,
          parseFloat(itemTotal),
          parseFloat(deliveryCharges)
        );

        updatedBill.taxAmount = taxAmount.toFixed(2);

        subTotal =
          parseFloat(itemTotal) +
          parseFloat(deliveryCharges) +
          parseFloat(addedTip) -
          parseFloat(discountedAmount);

        const grandTotal = (
          parseFloat(subTotal) + parseFloat(taxAmount)
        ).toFixed(2);

        updatedBill.originalGrandTotal = Math.round(parseFloat(grandTotal));
      }
    }

    updatedBill.subTotal = Math.round(parseFloat(subTotal).toFixed(2));

    // Ensure billDetail is initialized
    cart.billDetail = cart.billDetail || {};
    cart.cartDetail = updatedCartDetail;
    cart.billDetail = updatedBill;

    await cart.save();

    // Populate the cart with product and variant details
    const populatedCart = await CustomerCart.findOne({ customerId })
      .populate({
        path: "items.productId",
        select: "productName productImageURL description variants",
      })
      .exec();

    const populatedCartWithVariantNames = populatedCart.toObject();
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

    res.status(200).json({
      success: "Delivery address and details added to cart successfully",
      data: populatedCartWithVariantNames,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Apply promocode
const applyPromocodeController = async (req, res, next) => {
  try {
    const { promoCode } = req.body;
    const customerId = req.userAuth;

    // Ensure customer is authenticated
    if (!customerId) {
      return next(appError("Customer is not authenticated", 401));
    }

    const customerFound = await Customer.findById(customerId);
    if (!customerFound) {
      return next(appError("Customer not found", 404));
    }

    // Find the customer's cart
    const cart = await CustomerCart.findOne({ customerId });
    if (!cart) {
      return next(appError("Cart not found", 404));
    }

    // Find the promo code
    const promoCodeFound = await PromoCode.findOne({
      promoCode,
      geofenceId: customerFound.customerDetails.geofenceId,
      status: true,
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

    // Check if total cart price meets minimum order amount
    const totalCartPrice = cart.billDetail.itemTotal;
    if (totalCartPrice < promoCodeFound.minOrderAmount) {
      return next(
        appError(
          `Minimum order amount is ${promoCodeFound.minOrderAmount}`,
          400
        )
      );
    }

    // Check promo code validity dates
    const now = new Date();
    if (now < promoCodeFound.fromDate || now > promoCodeFound.toDate) {
      return next(appError("Promo code is not valid at this time", 400));
    }

    // Check user limit for promo code
    if (promoCodeFound.noOfUserUsed >= promoCodeFound.maxAllowedUsers) {
      return next(appError("Promo code usage limit reached", 400));
    }

    // Calculate discount amount
    let discountAmount = cart.billDetail.discountedAmount || 0;
    if (promoCodeFound.promoType === "Flat-discount") {
      discountAmount += promoCodeFound.discount;
    } else if (promoCodeFound.promoType === "Percentage-discount") {
      discountAmount += (
        (totalCartPrice * promoCodeFound.discount) /
        100
      ).toFixed(2);
      if (discountAmount > promoCodeFound.maxDiscountValue) {
        discountAmount += promoCodeFound.maxDiscountValue;
      }
    }

    // Apply discount based on where it should be applied
    let updatedTotal = totalCartPrice;
    if (promoCodeFound.appliedOn === "Cart-value") {
      updatedTotal -= discountAmount;
    } else if (promoCodeFound.appliedOn === "Delivery-charge") {
      if (cart.billDetail.originalDeliveryCharge) {
        const discountedDeliveryCharge =
          cart.billDetail.originalDeliveryCharge - discountAmount;

        cart.billDetail.discountedDeliveryCharge =
          discountedDeliveryCharge < 0 ? 0 : discountedDeliveryCharge;
      }
    }

    // Ensure updated total is not negative
    if (updatedTotal < 0) {
      updatedTotal = 0;
    }

    // Update cart and save
    const discountedDeliveryCharge =
      parseFloat(cart.billDetail.originalDeliveryCharge) -
      parseFloat(discountAmount);

    const discountedGrandTotal =
      cart.billDetail.originalGrandTotal - discountAmount;

    const discountedAmount = discountAmount;

    const subTotal =
      updatedTotal + discountedDeliveryCharge + (cart.billDetail.addedTip || 0);

    cart.billDetail.discountedDeliveryCharge =
      discountedDeliveryCharge.toFixed(2);
    cart.billDetail.discountedGrandTotal = Math.round(discountedGrandTotal);
    cart.billDetail.discountedAmount = discountedAmount;
    cart.billDetail.subTotal = Math.round(subTotal);

    promoCodeFound.noOfUserUsed += 1;

    await promoCodeFound.save();
    await cart.save();

    // Populate the cart with product and variant details
    const populatedCart = await CustomerCart.findOne({ customerId })
      .populate({
        path: "items.productId",
        select: "productName productImageURL description variants",
      })
      .exec();

    const populatedCartWithVariantNames = populatedCart.toObject();
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

    res.status(200).json({
      success: "Promo code applied successfully",
      data: {
        data: populatedCartWithVariantNames,
      },
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

    const orderAmount =
      cart.billDetail.discountedGrandTotal ||
      cart.billDetail.originalGrandTotal;

    const deliveryMode = cart.cartDetail.deliveryMode;

    const merchant = await Merchant.findById(cart.merchantId);

    if (!merchant) {
      return next(appError("Merchant not found", 404));
    }

    const deliveryTimeMinutes = parseInt(
      merchant.merchantDetail.deliveryTime,
      10
    );

    const deliveryTime = new Date();
    deliveryTime.setMinutes(deliveryTime.getMinutes() + deliveryTimeMinutes);

    let startDate, endDate;
    if (cart.cartDetail.deliveryOption === "Scheduled") {
      startDate = new Date(cart.cartDetail.startDate);
      startDate.setHours(0);
      startDate.setMinutes(0);
      startDate.setSeconds(0);
      startDate.setMilliseconds(0);

      endDate = new Date(cart.cartDetail.startDate);
      endDate.setHours(23);
      endDate.setMinutes(59);
      endDate.setSeconds(59);
      endDate.setMilliseconds(999);
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

    let customerTransation = {
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

      walletTransaction.orderId = newOrder._id;
      customer.walletTransactionDetail.push(walletTransaction);
      customer.transactionDetail.push(customerTransation);
      await customer.save();

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
          startDate, //: cart.cartDetail.startDate,
          endDate, //: cart.cartDetail.endDate,
          time: cart.cartDetail.time,
        });

        // Clear the cart
        await CustomerCart.deleteOne({ customerId });

        res.status(200).json({
          message: "Scheduled order created successfully",
          data: newOrder,
        });
        return;
      } else {
        // Generate a unique order ID
        const orderId = new mongoose.Types.ObjectId();

        // Store order details temporarily in the database
        const tempOrder = await TemperoryOrder.create({
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
        });

        // Clear the cart
        await CustomerCart.deleteOne({ customerId });

        if (!tempOrder) {
          return next(appError("Error in creating temperory order"));
        }

        // Return countdown timer to client
        res.status(200).json({
          message: "Custom order will be created in 1 minute.",
          orderId,
          countdown: 60,
        });

        // After 60 seconds, create the order if not canceled
        setTimeout(async () => {
          const storedOrderData = await TemperoryOrder.findOne({ orderId });

          if (storedOrderData) {
            let newOrder = await Order.create({
              customerId: storedOrderData.customerId,
              merchantId: newOrder.merchantId,
              items: storedOrderData.items,
              orderDetail: storedOrderData.orderDetail,
              billDetail: storedOrderData.billDetail,
              totalAmount: storedOrderData.totalAmount,
              status: storedOrderData.status,
              paymentMode: storedOrderData.paymentMode,
              paymentStatus: storedOrderData.paymentStatus,
              "orderDetailStepper.created": {
                by: storedOrder.orderDetail.deliveryAddress.fullName,
                userId: storedOrderData.customerId,
                date: new Date(),
              },
            });

            if (!newOrder) {
              return next(appError("Error in creating order"));
            }

            newOrder = await newOrder.populate("merchantId");

            // Remove the temporary order data from the database
            await TemperoryOrder.deleteOne({ orderId });

            //! Optionally, notify the user about successful order creation
            //? Notify the USER and ADMIN about successful order creation
            const customerData = {
              socket: {
                orderId: newOrder._id,
                orderDetail: newOrder.orderDetail,
                billDetail: newOrder.billDetail,
                orderDetailStepper: newOrder.orderDetailStepper.created,
              },
              fcm: {
                title: "Order created",
                body: "Your order was created successfully",
                image: "",
                orderId: newOrder._id,
                customerId: newOrder.customerId,
              },
            };

            const adminData = {
              socket: {
                _id: newOrder._id,
                orderStatus: newOrder.status,
                merchantName: newOrder.merchantId.merchantDetail.merchantName,
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
                orderDetailStepper: newOrder.orderDetailStepper.created,
              },
              fcm: {
                title: "New Order",
                body: "Your have a new pending order",
                image: "",
                orderId: newOrder._id,
              },
            };

            const parameter = {
              eventName: "newOrderCreated",
              user: "Customer",
              role1: "Admin",
              role2: "Merchant",
            };

            sendNotification(
              newOrder.customerId,
              parameter.eventName,
              customerData,
              parameter.user
            );

            sendNotification(
              process.env.ADMIN_ID,
              parameter.eventName,
              adminData,
              parameter.role1
            );

            sendNotification(
              newOrder.merchantId,
              parameter.eventName,
              adminData,
              parameter.role2
            );
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
      const tempOrder = await TemperoryOrder.create({
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
      });

      customer.transactionDetail.push(customerTransation);
      await customer.save();

      if (!tempOrder) {
        return next(appError("Error in creating temperory order"));
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
        const storedOrderData = await TemperoryOrder.findOne({ orderId });

        if (storedOrderData) {
          const newOrder = await Order.create({
            customerId: storedOrderData.customerId,
            merchantId: storedOrderData.merchantId,
            items: storedOrderData.items,
            orderDetail: storedOrderData.orderDetail,
            billDetail: storedOrderData.billDetail,
            totalAmount: storedOrderData.totalAmount,
            status: storedOrderData.status,
            paymentMode: storedOrderData.paymentMode,
            paymentStatus: storedOrderData.paymentStatus,
            "orderDetailStepper.created": {
              by: storedOrder.orderDetail.deliveryAddress.fullName,
              userId: storedOrderData.customerId,
              date: new Date(),
            },
          });

          if (!newOrder) {
            return next(appError("Error in creating order"));
          }

          newOrder = await newOrder.populate("merchantId");

          // Remove the temporary order data from the database
          await TemperoryOrder.deleteOne({ orderId });

          //? Notify the USER and ADMIN about successful order creation
          const customerData = {
            socket: {
              orderId: newOrder._id,
              orderDetail: newOrder.orderDetail,
              billDetail: newOrder.billDetail,
              orderDetailStepper: newOrder.orderDetailStepper.created,
            },
            fcm: {
              title: "Order created",
              body: "Your order was created successfully",
              image: "",
              orderId: newOrder._id,
              customerId: newOrder.customerId,
            },
          };

          const adminData = {
            socket: {
              _id: newOrder._id,
              orderStatus: newOrder.status,
              merchantName: newOrder.merchantId.merchantDetail.merchantName,
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
              orderDetailStepper: newOrder.orderDetailStepper.created,
            },
            fcm: {
              title: "New Order",
              body: "Your have a new pending order",
              image: "",
              orderId: newOrder._id,
            },
          };

          const parameter = {
            eventName: "newOrderCreated",
            user: "Customer",
            role1: "Admin",
            role2: "Merchant",
          };

          sendNotification(
            newOrder.customerId,
            parameter.eventName,
            customerData,
            parameter.user
          );

          sendNotification(
            process.env.ADMIN_ID,
            parameter.eventName,
            adminData,
            parameter.role1
          );

          sendNotification(
            newOrder.merchantId,
            parameter.eventName,
            adminData,
            parameter.role2
          );
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

    // if (deliveryMode === "Home Delivery") {
    //   const orderResponse = {
    //     _id: newOrder._id,
    //     customerId: newOrder.customerId,
    //     customerName:
    //       customer.fullName || newOrder.orderDetail.deliveryAddress.fullName,
    //     merchantId: newOrder.merchantId,
    //     merchantName: merchant.merchantDetail.merchantName,
    //     status: newOrder.status,
    //     totalAmount: newOrder.totalAmount,
    //     paymentMode: newOrder.paymentMode,
    //     paymentStatus: newOrder.paymentStatus,
    //     items: newOrder.items,
    //     deliveryAddress: newOrder.orderDetail.deliveryAddress,
    //     billDetail: newOrder.billDetail,
    //     orderDetail: {
    //       pickupLocation: merchant.merchantDetail.location,
    //       deliveryLocation: cart.cartDetail.deliveryLocation,
    //       deliveryMode: cart.cartDetail.deliveryMode,
    //       deliveryOption: cart.cartDetail.deliveryOption,
    //       instructionToMerchant: cart.cartDetail.instructionToMerchant,
    //       instructionToDeliveryAgent:
    //         cart.cartDetail.instructionToDeliveryAgent,
    //       distance: cart.cartDetail.distance,
    //     },
    //     createdAt: newOrder.createdAt,
    //     updatedAt: newOrder.updatedAt,
    //   };

    //   res.status(200).json({
    //     message: "Order created successfully",
    //     data: orderResponse,
    //   });
    // } else {
    //   const orderResponse = {
    //     _id: newOrder._id,
    //     customerId: newOrder.customerId,
    //     customerName: customer.fullName || deliveryAddress.fullName,
    //     merchantId: newOrder.merchantId,
    //     merchantName: merchant.merchantDetail.merchantName,
    //     status: newOrder.status,
    //     totalAmount: newOrder.totalAmount,
    //     paymentMode: newOrder.paymentMode,
    //     paymentStatus: newOrder.paymentStatus,
    //     items: newOrder.items,
    //     pickupLocation: {
    //       merchantName: merchant.merchantDetail.merchantName,
    //       location: merchant.merchantDetail.displayAddress,
    //     },
    //     billDetail: newOrder.billDetail,
    //     orderDetail: {
    //       pickupLocation: merchant.merchantDetail.location,
    //       deliveryMode: cart.cartDetail.deliveryMode,
    //       deliveryOption: cart.cartDetail.deliveryOption,
    //       instructionToMerchant: cart.cartDetail.instructionToMerchant,
    //       instructionToDeliveryAgent:
    //         cart.cartDetail.instructionToDeliveryAgent,
    //       distance: cart.cartDetail.distance,
    //     },
    //     createdAt: newOrder.createdAt,
    //     updatedAt: newOrder.updatedAt,
    //   };

    //   res.status(200).json({
    //     message: "Order created successfully",
    //     data: orderResponse,
    //   });
    // }
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

    const deliveryMode = cart.cartDetail.deliveryMode;

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

    let formattedItems = populatedCartWithVariantNames.items.map((items) => {
      return {
        itemName: items.productId.productName,
        description: items.productId.description,
        itemImageURL: items.productId.productImageURL,
        quantity: items.quantity,
        price: items.price,
        variantTypeName: items.variantTypeId.variantTypeName,
      };
    });

    const orderAmount =
      cart.billDetail.discountedGrandTotal ||
      cart.billDetail.originalGrandTotal;

    let startDate, endDate;
    if (cart.cartDetail.deliveryOption === "Scheduled") {
      startDate = new Date(cart.cartDetail.startDate);
      startDate.setHours(0);
      startDate.setMinutes(0);
      startDate.setSeconds(0);
      startDate.setMilliseconds(0);

      endDate = new Date(cart.cartDetail.startDate);
      endDate.setHours(23);
      endDate.setMinutes(59);
      endDate.setSeconds(59);
      endDate.setMilliseconds(999);
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

    let customerTransation = {
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
      });

      // Clear the cart
      await CustomerCart.deleteOne({ customerId });

      customer.transactionDetail.push(customerTransation);
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
      const tempOrder = await TemperoryOrder.create({
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
      });

      customer.transactionDetail.push(customerTransation);
      await customer.save();

      if (!tempOrder) {
        return next(appError("Error in creating temperory order"));
      }

      await CustomerCart.deleteOne({ customerId });

      // Return countdown timer to client
      res.status(200).json({
        message: "Custom order will be created in 1 minute.",
        orderId,
        countdown: 60,
      });

      // After 60 seconds, create the order if not canceled
      setTimeout(async () => {
        const storedOrderData = await TemperoryOrder.findOne({ orderId });

        if (storedOrderData) {
          const newOrder = await Order.create({
            customerId: storedOrderData.customerId,
            items: storedOrderData.items,
            orderDetail: storedOrderData.orderDetail,
            billDetail: storedOrderData.billDetail,
            totalAmount: storedOrderData.totalAmount,
            status: storedOrderData.status,
            paymentMode: storedOrderData.paymentMode,
            paymentStatus: storedOrderData.paymentStatus,
            "orderDetailStepper.created": {
              by: storedOrder.orderDetail.deliveryAddress.fullName,
              userId: storedOrderData.customerId,
              date: new Date(),
            },
          });

          if (!newOrder) {
            return next(appError("Error in creating order"));
          }

          newOrder = await newOrder.populate("merchantId");

          // Remove the temporary order data from the database
          await TemperoryOrder.deleteOne({ orderId });

          //? Notify the USER and ADMIN about successful order creation
          const customerData = {
            socket: {
              orderId: newOrder._id,
              orderDetail: newOrder.orderDetail,
              billDetail: newOrder.billDetail,
              orderDetailStepper: newOrder.orderDetailStepper.created,
            },
            fcm: {
              title: "Order created",
              body: "Your order was created successfully",
              image: "",
              orderId: newOrder._id,
              customerId: newOrder.customerId,
            },
          };

          const adminData = {
            socket: {
              _id: newOrder._id,
              orderStatus: newOrder.status,
              merchantName: newOrder.merchantId.merchantDetail.merchantName,
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
              orderDetailStepper: newOrder.orderDetailStepper.created,
            },
            fcm: {
              title: "New Order",
              body: "Your have a new pending order",
              image: "",
              orderId: newOrder._id,
            },
          };

          const parameter = {
            eventName: "newOrderCreated",
            user: "Customer",
            role1: "Admin",
            role2: "Merchant",
          };

          sendNotification(
            newOrder.customerId,
            parameter.eventName,
            customerData,
            parameter.user
          );

          sendNotification(
            process.env.ADMIN_ID,
            parameter.eventName,
            adminData,
            parameter.role1
          );

          sendNotification(
            newOrder.merchantId,
            parameter.eventName,
            adminData,
            parameter.role2
          );
        }
      }, 60000);

      // Clear the cart

      // if (deliveryMode === "Home Delivery") {
      //   const orderResponse = {
      //     _id: newOrder._id,
      //     customerId: newOrder.customerId,
      //     customerName: customer.fullName || deliveryAddress.fullName,
      //     merchantId: newOrder.merchantId,
      //     merchantName: merchant.merchantDetail.merchantName,
      //     status: newOrder.status,
      //     totalAmount: newOrder.totalAmount,
      //     paymentMode: newOrder.paymentMode,
      //     paymentStatus: newOrder.paymentStatus,
      //     items: newOrder.items,
      //     deliveryAddress: newOrder.orderDetail.deliveryAddress,
      //     billDetail: newOrder.billDetail,
      //     orderDetail: {
      //       pickupLocation: merchant.merchantDetail.location,
      //       deliveryLocation: cart.cartDetail.deliveryLocation,
      //       deliveryMode: cart.cartDetail.deliveryMode,
      //       deliveryOption: cart.cartDetail.deliveryOption,
      //       instructionToMerchant: cart.cartDetail.instructionToMerchant,
      //       instructionToDeliveryAgent:
      //         cart.cartDetail.instructionToDeliveryAgent,
      //       distance: cart.cartDetail.distance,
      //     },
      //     createdAt: newOrder.createdAt,
      //     updatedAt: newOrder.updatedAt,
      //   };

      //   res.status(200).json({
      //     message: "Order created successfully",
      //     data: orderResponse,
      //   });
      // } else {
      //   const orderResponse = {
      //     _id: newOrder._id,
      //     customerId: newOrder.customerId,
      //     customerName: customer.fullName || deliveryAddress.fullName,
      //     merchantId: newOrder.merchantId,
      //     merchantName: merchant.merchantDetail.merchantName,
      //     status: newOrder.status,
      //     totalAmount: newOrder.totalAmount,
      //     paymentMode: newOrder.paymentMode,
      //     paymentStatus: newOrder.paymentStatus,
      //     items: newOrder.items,
      //     pickupLocation: {
      //       merchantName: merchant.merchantDetail.merchantName,
      //       location: merchant.merchantDetail.displayAddress,
      //     },
      //     billDetail: newOrder.billDetail,
      //     orderDetail: {
      //       pickupLocation: merchant.merchantDetail.location,
      //       deliveryMode: cart.cartDetail.deliveryMode,
      //       deliveryOption: cart.cartDetail.deliveryOption,
      //       instructionToMerchant: cart.cartDetail.instructionToMerchant,
      //       instructionToDeliveryAgent:
      //         cart.cartDetail.instructionToDeliveryAgent,
      //       distance: cart.cartDetail.distance,
      //     },
      //     createdAt: newOrder.createdAt,
      //     updatedAt: newOrder.updatedAt,
      //   };

      //   res.status(200).json({
      //     message: "Order created successfully",
      //     data: orderResponse,
      //   });
      // }
    }
  } catch (err) {
    next(appError(err.message));
  }
};

const cancelOrderBeforeCreationController = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const orderFound = await TemperoryOrder.findOne({ orderId });

    const customerFound = await Customer.findById(orderFound.customerId);

    let updatedTransactionDetail = {
      transactionType: "Refund",
      madeon: new Date(),
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
        await TemperoryOrder.deleteOne({ orderId });

        customerFound.transactionDetail.push(updatedTransactionDetail);

        await customerFound.save();

        res.status(200).json({
          message: "Order cancelled and amount refunded to wallet",
        });
        return;
      } else if (orderFound.paymentMode === "Cash-on-delivery") {
        // Remove the temporary order data from the database
        await TemperoryOrder.deleteOne({ orderId });

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
          message: "Order cancelled and amount refunded",
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

module.exports = {
  getAllBusinessCategoryController,
  homeSearchController,
  listRestaurantsController,
  getMerchantWithCategoriesAndProductsController,
  filterMerchantController,
  searchProductsInMerchantController,
  filterAndSortProductsController,
  toggleProductFavoriteController,
  toggleMerchantFavoriteController,
  addRatingToMerchantController,
  getTotalRatingOfMerchantController,
  addOrUpdateCartItemController,
  addCartDetailsController,
  applyPromocodeController,
  orderPaymentController,
  verifyOnlinePaymentController,
  cancelOrderBeforeCreationController,
};
