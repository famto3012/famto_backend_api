const appError = require("../../utils/appError");
const turf = require("@turf/turf");
const generateToken = require("../../utils/generateToken");
const os = require("os");
const Customer = require("../../models/Customer");
const Product = require("../../models/Product");
const { validationResult } = require("express-validator");
const geoLocation = require("../../utils/getGeoLocation");
const {
  deleteFromFirebase,
  uploadToFirebase,
} = require("../../utils/imageOperation");
const BusinessCategory = require("../../models/BusinessCategory");
const Geofence = require("../../models/Geofence");
const Merchant = require("../../models/Merchant");
const Category = require("../../models/Category");
const {
  sortMerchantsBySponsorship,
  getDistanceFromPickupToDelivery,
  calculateDeliveryCharges,
  getTaxAmount,
} = require("../../utils/customerAppHelpers");
const CustomerCart = require("../../models/CustomerCart");
const mongoose = require("mongoose");
const CustomerPricing = require("../../models/CustomerPricing");
const PromoCode = require("../../models/PromoCode");
const {
  createRazorpayOrderId,
  verifyPayment,
} = require("../../utils/razorpayPayment");
const Order = require("../../models/Order");
const ScheduledOrder = require("../../models/ScheduledOrder");
const Agent = require("../../models/Agent");
const {
  convertToUTC,
  formatDate,
  formatTime,
} = require("../../utils/formatters");
const CustomerSubscription = require("../../models/CustomerSubscription");
const LoyaltyPoint = require("../../models/LoyaltyPoint");

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

// Get all available business categories according to the order
const getAllBusinessCategoryController = async (req, res, next) => {
  try {
    const allBusinessCategories = await BusinessCategory.find({})
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
      .select("productName productImageURL type")
      .exec();

    // Search in Merchant by merchantName
    const merchants = await Merchant.find({
      "merchantDetail.merchantName": { $regex: query, $options: "i" },
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

  console.log(businessCategoryId);
  try {
    // Fetch the authenticated customer to get their favorite merchants, if they exist
    let currentCustomer = null;
    if (customerId) {
      currentCustomer = await Customer.findById(customerId)
        .select("customerDetails.favoriteMerchants")
        .exec();
    }

    // Fetch all geofences from the database
    const geofences = await Geofence.find({}).exec();

    // Check if the customer's location is within any geofence
    const customerLocation = [latitude, longitude]; // [latitude, longitude]

    let foundGeofence = null;
    for (const geofence of geofences) {
      const polygon = turf.polygon([
        geofence.coordinates.map((coord) => [coord[1], coord[0]]),
      ]); // Note: Turf uses [longitude, latitude]
      const point = turf.point([longitude, latitude]); // Note: Turf uses [longitude, latitude]
      if (turf.booleanPointInPolygon(point, polygon)) {
        foundGeofence = geofence;
        break;
      }
    }

    if (!foundGeofence) {
      return next(appError("Geofence not found", 404));
    }

    // Query merchants based on geofence and other conditions
    const merchants = await Merchant.find({
      "merchantDetail.geofenceId": foundGeofence._id,
      "merchantDetail.businessCategoryId": businessCategoryId,
      isBlocked: false,
      isApproved: "Approved",
    }).exec();

    // Filter merchants based on serving radius
    const filteredMerchants = merchants.filter((merchant) => {
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
    const { merchantId } = req.params;
    const { customerId } = req.body;

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
          const validFrom = new Date(product.discountId.validFrom);
          const validTo = new Date(product.discountId.validTo);

          // Adjusting the validTo date to the end of the day
          validTo.setHours(23, 59, 59, 999);

          let discountPrice = product.price;
          let variantsWithDiscount = product.variants;

          if (
            product.discountId &&
            validFrom <= currentDate &&
            validTo >= currentDate &&
            product.discountId.status
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
        phoneNumber: merchantFound.phoneNumber || "N/A",
        FSSAINumber: merchantFound.merchantDetail?.FSSAINumber || "N/A",
        merchantName: merchantFound.merchantDetail?.merchantName || "N/A",
        deliveryTime: merchantFound.merchantDetail?.deliveryTime || "N/A",
        description: merchantFound.merchantDetail?.description || "N/A",
        displayAddress: merchantFound.merchantDetail?.displayAddress || "N/A",
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
    const { productId, quantity, price, variantTypeId } = req.body;
    const customerId = req.userAuth;

    if (!customerId) {
      return next(appError("Customer is not authenticated", 401));
    }

    const product = await Product.findById(productId).populate("categoryId");

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

    let cart = await CustomerCart.findOne({ customerId });

    if (cart) {
      if (!cart.merchantId.equals(merchantId)) {
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
      cart.items[existingItemIndex].price = price;
      cart.items[existingItemIndex].totalPrice = quantity * price;

      if (cart.items[existingItemIndex].quantity <= 0) {
        cart.items.splice(existingItemIndex, 1);
      }
    } else {
      if (quantity > 0) {
        const newItem = {
          productId,
          quantity,
          price,
          totalPrice: quantity * price,
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

    if (deliveryMode === "Delivery") {
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
          } else if (addressType === "work") {
            customer.customerDetails.workAddress = deliveryAddress;
          } else if (addressType === "other") {
            customer.customerDetails.otherAddress.push({
              id: new mongoose.Types.ObjectId(),
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

    console.log("Current delivery address of this order is: ", deliveryAddress);

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

    let updatedCartDetail = {
      pickupLocation: pickupCoordinates,
      deliveryMode,
      deliveryOption: startDate && endDate && time ? "Scheduled" : "On-demand",
      instructionToMerchant,
      instructionToDeliveryAgent,
      startDate,
      endDate,
      time: convertToUTC(time),
    };

    let updatedBill = {
      addedTip,
      itemTotal: parseFloat(itemTotal).toFixed(2),
    };

    let subTotal;

    if (deliveryMode === "Take-away") {
      updatedCartDetail = {
        ...updatedCartDetail,
        deliveryLocation: pickupCoordinates,
        distance: 0,
      };

      // Set originalGrandTotal without tax and delivery charges
      updatedBill.originalGrandTotal = parseFloat(itemTotal).toFixed(2);

      cart.cartDetail = updatedCartDetail;

      subTotal = itemTotal + parseFloat(addedTip);
    } else {
      updatedCartDetail = {
        ...updatedCartDetail,
        deliveryLocation: deliveryCoordinates,
        deliveryAddress,
        distance: 0,
      };

      // Calculate distance using MapMyIndia API
      const distanceFromPickupToDelivery =
        await getDistanceFromPickupToDelivery(
          pickupCoordinates,
          deliveryCoordinates
        );

      updatedCartDetail.distance = distanceFromPickupToDelivery;

      const businessCategoryId = merchant.merchantDetail.businessCategoryId;

      const businessCategoryTitle = await BusinessCategory.findById(
        businessCategoryId
      );

      const customerPricing = await CustomerPricing.findOne({
        ruleName: businessCategoryTitle.title,
        geofenceId: customer.customerDetails.geofenceId,
        status: true,
      });

      if (!customerPricing) {
        return res.status(404).json({ error: "Customer pricing not found" });
      }

      const baseFare = customerPricing.baseFare;
      const baseDistance = customerPricing.baseDistance;
      const fareAfterBaseDistance = customerPricing.fareAfterBaseDistance;

      const deliveryCharges = calculateDeliveryCharges(
        distanceFromPickupToDelivery,
        baseFare,
        baseDistance,
        fareAfterBaseDistance
      );

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
          parseFloat(taxAmount)
        ).toFixed(2);

        updatedBill.originalGrandTotal = parseFloat(grandTotal);
        subTotal =
          parseFloat(itemTotal) * diffDays +
          parseFloat(scheduledDeliveryCharge) +
          parseFloat(addedTip);
      } else {
        updatedBill.originalDeliveryCharge = deliveryCharges.toFixed(2);

        const taxAmount = await getTaxAmount(
          businessCategoryId,
          merchant.merchantDetail.geofenceId,
          parseFloat(itemTotal),
          parseFloat(deliveryCharges)
        );

        updatedBill.taxAmount = taxAmount.toFixed(2);

        const grandTotal = (
          parseFloat(itemTotal) +
          parseFloat(deliveryCharges) +
          parseFloat(addedTip) +
          parseFloat(taxAmount)
        ).toFixed(2);

        updatedBill.originalGrandTotal = parseFloat(grandTotal);
        subTotal =
          parseFloat(itemTotal) +
          parseFloat(deliveryCharges) +
          parseFloat(addedTip);
      }
    }
    updatedBill.subTotal = parseFloat(subTotal).toFixed(2);

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
    let discountAmount = 0;
    if (promoCodeFound.promoType === "Flat-discount") {
      discountAmount = promoCodeFound.discount;
    } else if (promoCodeFound.promoType === "Percentage-discount") {
      discountAmount = (
        (totalCartPrice * promoCodeFound.discount) /
        100
      ).toFixed(2);
      if (discountAmount > promoCodeFound.maxDiscountValue) {
        discountAmount = promoCodeFound.maxDiscountValue;
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
    cart.billDetail.discountedGrandTotal = discountedGrandTotal;
    cart.billDetail.discountedAmount = discountedAmount;
    cart.billDetail.subTotal = subTotal;

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
        // promocodeApplied: discountAmount,
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

    const cart = await CustomerCart.findOne({ customerId });
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

    let endDate;
    if (cart.cartDetail.deliveryOption === "Scheduled") {
      // Parse the provided time and set it to the end date
      const [hours, minutes] = cart.cartDetail.time.split(":");
      const ampm = cart.cartDetail.time.slice(-2).toUpperCase();
      const parsedHours =
        ampm === "PM" ? (parseInt(hours) % 12) + 12 : parseInt(hours) % 12;

      endDate = new Date(cart.cartDetail.endDate);
      endDate.setHours(parsedHours);
      endDate.setMinutes(parseInt(minutes));
      endDate.setSeconds(0);
      endDate.setMilliseconds(0);
    }

    let newOrder;

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

    const loyaltyPointCriteria = await LoyaltyPoint.findOne({ status: true });

    // let loyaltyPoint = 0;
    const loyaltyPointEarnedToday =
      customer.customerDetails?.loyaltyPointEarnedToday || 0;

    if (loyaltyPointCriteria) {
      if (orderAmount >= loyaltyPointCriteria.minOrderAmountForEarning) {
        if (loyaltyPointEarnedToday < loyaltyPointCriteria.maxEarningPoint) {
          const calculatedLoyaltyPoint = Math.min(
            orderAmount * loyaltyPointCriteria.earningCriteraPoint,
            loyaltyPointCriteria.maxEarningPoint - loyaltyPointEarnedToday
          );
          customer.customerDetails.loyaltyPointEarnedToday =
            customer.customerDetails.loyaltyPointEarnedToday +
            Number(calculatedLoyaltyPoint);
          customer.customerDetails.totalLoyaltyPointEarned =
            customer.customerDetails.totalLoyaltyPointEarned +
            Number(calculatedLoyaltyPoint);
        }
      }
    }

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
      await customer.save();

      if (cart.cartDetail.deliveryOption === "Scheduled") {
        // Create a scheduled order

        newOrder = await ScheduledOrder.create({
          customerId,
          merchantId: cart.merchantId,
          items: cart.items,
          orderDetail: cart.cartDetail,
          billDetail: orderBill,
          totalAmount: orderAmount,
          status: "Pending",
          paymentMode: "Famto-cash",
          paymentStatus: "Completed",
          startDate: cart.cartDetail.startDate,
          endDate, //: cart.cartDetails.endDate,
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
        // Create the order
        newOrder = await Order.create({
          customerId,
          merchantId: cart.merchantId,
          items: cart.items,
          orderDetail: cart.cartDetail,
          billDetail: orderBill,
          totalAmount: orderAmount,
          status: "Pending",
          paymentMode: "Famto-cash",
          paymentStatus: "Completed",
        });

        // Clear the cart
        await CustomerCart.deleteOne({ customerId });
      }

      walletTransaction.orderId = newOrder._id;
      customer.walletTransactionDetail.push(walletTransaction);
      customer.transactionDetail.push(customerTransation);
      await customer.save();
    } else if (paymentMode === "Cash-on-delivery") {
      newOrder = await Order.create({
        customerId,
        merchantId: cart.merchantId,
        items: cart.items,
        orderDetail: cart.cartDetail,
        billDetail: orderBill,
        totalAmount: orderAmount,
        status: "Pending",
        paymentMode: "Cash-on-delivery",
        paymentStatus: "Pending",
      });

      customer.transactionDetail.push(customerTransation);
      await customer.save();

      // Clear the cart
      await CustomerCart.deleteOne({ customerId });
    } else if (paymentMode === "Online-payment") {
      const { success, orderId, error } = await createRazorpayOrderId(
        orderAmount
      );

      if (!success) {
        return next(appError("Error in creating Razorpay order", 500));
      }

      res.status(200).json({ success: true, orderId, amount: orderAmount });
      return;
    } else {
      return next(appError("Invalid payment mode", 400));
    }

    if (deliveryMode === "Delivery") {
      const orderResponse = {
        _id: newOrder._id,
        customerId: newOrder.customerId,
        customerName: customer.fullName || deliveryAddress.fullName,
        merchantId: newOrder.merchantId,
        merchantName: merchant.merchantDetail.merchantName,
        status: newOrder.status,
        totalAmount: newOrder.totalAmount,
        paymentMode: newOrder.paymentMode,
        paymentStatus: newOrder.paymentStatus,
        items: newOrder.items,
        deliveryAddress: newOrder.orderDetail.deliveryAddress,
        billDetail: newOrder.billDetail,
        orderDetail: {
          pickupLocation: merchant.merchantDetail.location,
          deliveryLocation: cart.cartDetail.deliveryLocation,
          deliveryMode: cart.cartDetail.deliveryMode,
          deliveryOption: cart.cartDetail.deliveryOption,
          instructionToMerchant: cart.cartDetail.instructionToMerchant,
          instructionToDeliveryAgent:
            cart.cartDetail.instructionToDeliveryAgent,
          distance: cart.cartDetail.distance,
        },
        createdAt: newOrder.createdAt,
        updatedAt: newOrder.updatedAt,
      };

      res.status(200).json({
        message: "Order created successfully",
        data: orderResponse,
      });
    } else {
      const orderResponse = {
        _id: newOrder._id,
        customerId: newOrder.customerId,
        customerName: customer.fullName || deliveryAddress.fullName,
        merchantId: newOrder.merchantId,
        merchantName: merchant.merchantDetail.merchantName,
        status: newOrder.status,
        totalAmount: newOrder.totalAmount,
        paymentMode: newOrder.paymentMode,
        paymentStatus: newOrder.paymentStatus,
        items: newOrder.items,
        pickupLocation: {
          merchantName: merchant.merchantDetail.merchantName,
          location: merchant.merchantDetail.displayAddress,
        },
        billDetail: newOrder.billDetail,
        orderDetail: {
          pickupLocation: merchant.merchantDetail.location,
          deliveryMode: cart.cartDetail.deliveryMode,
          deliveryOption: cart.cartDetail.deliveryOption,
          instructionToMerchant: cart.cartDetail.instructionToMerchant,
          instructionToDeliveryAgent:
            cart.cartDetail.instructionToDeliveryAgent,
          distance: cart.cartDetail.distance,
        },
        createdAt: newOrder.createdAt,
        updatedAt: newOrder.updatedAt,
      };

      res.status(200).json({
        message: "Order created successfully",
        data: orderResponse,
      });
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

    const cart = await CustomerCart.findOne({ customerId });
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

    const orderAmount = cart.discountedGrandTotal || cart.originalGrandTotal;

    let endDate;
    if (cart.cartDetail.deliveryOption === "Scheduled") {
      // Parse the provided time and set it to the end date
      const [hours, minutes] = cart.cartDetail.time.split(":");
      const ampm = cart.cartDetail.time.slice(-2).toUpperCase();
      const parsedHours =
        ampm === "PM" ? (parseInt(hours) % 12) + 12 : parseInt(hours) % 12;

      endDate = new Date(cart.cartDetail.endDate);
      endDate.setHours(parsedHours);
      endDate.setMinutes(parseInt(minutes));
      endDate.setSeconds(0);
      endDate.setMilliseconds(0);
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

    // Check if the order is scheduled
    if (cart.cartDetail.deliveryOption === "Scheduled") {
      // Create a scheduled order
      const newOrder = await ScheduledOrder.create({
        customerId,
        merchantId: cart.merchantId,
        items: cart.items,
        orderDetail: cart.cartDetail,
        billDetail: orderBill,
        totalAmount: orderAmount,
        status: "Pending",
        paymentMode: "Online-payment",
        paymentStatus: "Completed",
        startDate: cart.cartDetail.startDate,
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
      // Create the order
      const newOrder = await Order.create({
        customerId,
        merchantId: cart.merchantId,
        items: cart.items,
        orderDetail: cart.cartDetail,
        billDetail: orderBill,
        totalAmount: orderAmount,
        status: "Pending",
        paymentMode: "Online-payment",
        paymentStatus: "Completed",
        paymentId: paymentDetails.razorpay_payment_id,
      });

      // Clear the cart
      await CustomerCart.deleteOne({ customerId });
      customer.transactionDetail.push(customerTransation);
      await customer.save();

      if (deliveryMode === "Delivery") {
        const orderResponse = {
          _id: newOrder._id,
          customerId: newOrder.customerId,
          customerName: customer.fullName || deliveryAddress.fullName,
          merchantId: newOrder.merchantId,
          merchantName: merchant.merchantDetail.merchantName,
          status: newOrder.status,
          totalAmount: newOrder.totalAmount,
          paymentMode: newOrder.paymentMode,
          paymentStatus: newOrder.paymentStatus,
          items: newOrder.items,
          deliveryAddress: newOrder.orderDetail.deliveryAddress,
          billDetail: newOrder.billDetail,
          orderDetail: {
            pickupLocation: merchant.merchantDetail.location,
            deliveryLocation: cart.cartDetail.deliveryLocation,
            deliveryMode: cart.cartDetail.deliveryMode,
            deliveryOption: cart.cartDetail.deliveryOption,
            instructionToMerchant: cart.cartDetail.instructionToMerchant,
            instructionToDeliveryAgent:
              cart.cartDetail.instructionToDeliveryAgent,
            distance: cart.cartDetail.distance,
          },
          createdAt: newOrder.createdAt,
          updatedAt: newOrder.updatedAt,
        };

        res.status(200).json({
          message: "Order created successfully",
          data: orderResponse,
        });
      } else {
        const orderResponse = {
          _id: newOrder._id,
          customerId: newOrder.customerId,
          customerName: customer.fullName || deliveryAddress.fullName,
          merchantId: newOrder.merchantId,
          merchantName: merchant.merchantDetail.merchantName,
          status: newOrder.status,
          totalAmount: newOrder.totalAmount,
          paymentMode: newOrder.paymentMode,
          paymentStatus: newOrder.paymentStatus,
          items: newOrder.items,
          pickupLocation: {
            merchantName: merchant.merchantDetail.merchantName,
            location: merchant.merchantDetail.displayAddress,
          },
          billDetail: newOrder.billDetail,
          orderDetail: {
            pickupLocation: merchant.merchantDetail.location,
            deliveryMode: cart.cartDetail.deliveryMode,
            deliveryOption: cart.cartDetail.deliveryOption,
            instructionToMerchant: cart.cartDetail.instructionToMerchant,
            instructionToDeliveryAgent:
              cart.cartDetail.instructionToDeliveryAgent,
            distance: cart.cartDetail.distance,
          },
          createdAt: newOrder.createdAt,
          updatedAt: newOrder.updatedAt,
        };

        res.status(200).json({
          message: "Order created successfully",
          data: orderResponse,
        });
      }
    }
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

    orderFound.orderRating.ratingToDeliveryAgent.review = review;
    orderFound.orderRating.ratingToDeliveryAgent.rating = rating;

    let updatedAgentRating = {
      customerId: currentCustomer,
      review,
      rating,
    };

    agentFound.ratingsByCustomers.push(updatedAgentRating);

    await orderFound.save();
    await agentFound.save();

    res.status(200).josn({ message: "Agent rated successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get favourite merchants
const getFavoriteMerchantsController = async (req, res, next) => {
  try {
    const currentCustomer = req.userAuth;

    const customer = await Customer.findById(currentCustomer)
      .select("customerDetails.location customerDetails.favoriteMerchants")
      .populate("customerDetails.favoriteMerchants");

    if (!customer || !customer.customerDetails) {
      return next(appError("Customer details not found", 404));
    }

    const favoriteMerchants = customer.customerDetails.favoriteMerchants;

    const customerLocation = customer.customerDetails.location?.[0];

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
          restaurantType: merchant.merchantDetail.taurant || "N/A",
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

    const currentDate = new Date(startDate);
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

// ------------------------------------------
// PICK & DROP
// ------------------------------------------

const addPickUpAddressController = async (req, res, next) => {
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

    const currentCustomer = req.userAuth;

    const customerFound = await Customer.findById(currentCustomer);

    if (!customerFound) {
      return next(appError("Customer not found", 404));
    }
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
};
