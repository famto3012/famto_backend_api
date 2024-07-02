const appError = require("../../utils/appError");
const turf = require("@turf/turf");
const generateToken = require("../../utils/generateToken");
const os = require("os");
const Customer = require("../../models/Customer");
const { validationResult } = require("express-validator");
const geoLocation = require("../../utils/getGeoLocation");
const {
  deleteFromFirebase,
  uploadToFirebase,
} = require("../../utils/imageOperation");
const BusinessCategory = require("../../models/BusinessCategory");
const Product = require("../../models/Product");
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
  const { latitude, longitude, customerId } = req.body;
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
    const sortedMerchants = filteredMerchants.sort((a, b) => {
      const aSponsorship = a.sponsorshipDetail.some((s) => s.sponsorshipStatus);
      const bSponsorship = b.sponsorshipDetail.some((s) => s.sponsorshipStatus);
      return bSponsorship - aSponsorship;
    });

    // Extracting required fields from filtered merchants including distance and favorite status
    const simplifiedMerchants = sortedMerchants.map((merchant) => {
      const merchantLocation = merchant.merchantDetail.location;
      const distance = turf
        .distance(turf.point(merchantLocation), turf.point(customerLocation), {
          units: "kilometers",
        })
        .toFixed(2);

      // Determine if the merchant is a favorite
      const isFavorite =
        currentCustomer?.customerDetails?.favoriteMerchants?.includes(
          merchant._id
        ) ?? false;

      return {
        _id: merchant._id,
        merchantName: merchant.merchantDetail.merchantName,
        preparationTime: merchant.merchantDetail.deliveryTime,
        description: merchant.merchantDetail.description,
        averageRating: merchant.merchantDetail.averageRating,
        status: merchant.status,
        distanceInKM: parseFloat(distance),
        restaurantType: merchant.merchantDetail.ifRestaurant || "N/A",
        merchantImageURL: merchant.merchantDetail.merchantImageURL,
        isFavorite,
      };
    });

    res.status(200).json({
      message: "Available merchants",
      data: simplifiedMerchants,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// Get all the availbel categories and products of a merchant
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
        ifRestaurant: merchant.merchantDetail.ifRestaurant,
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

    const merchantId = product.categoryId.merchantId; // Getting the merchantId

    if (product.variants.length > 0 && !variantTypeId) {
      return res
        .status(400)
        .json({ error: "Variant ID is required for this product" });
    }

    let cart = await CustomerCart.findOne({ customerId });

    if (cart) {
      // Check if the existing cart is from a different merchant
      if (!cart.merchantId.equals(merchantId)) {
        // Replace the cart items if the merchant is different
        cart.merchantId = merchantId;
        cart.items = [];
      }
    } else {
      // Create a new cart if none exists
      cart = new CustomerCart({ customerId, merchantId, items: [] });
    }

    // Calculate the total price for the new item
    const totalPriceForItem = quantity * price;

    // Check for existing item with the same productId and variantTypeId
    const existingItemIndex = cart.items.findIndex(
      (item) =>
        item.productId.equals(productId) &&
        ((variantTypeId &&
          item.variantTypeId &&
          item.variantTypeId.equals(variantTypeId)) ||
          (!variantTypeId && !item.variantTypeId))
    );

    if (existingItemIndex >= 0) {
      // Update the quantity if the item already exists in the cart
      cart.items[existingItemIndex].quantity = quantity;
      cart.items[existingItemIndex].totalPrice =
        quantity * cart.items[existingItemIndex].price;

      if (cart.items[existingItemIndex].quantity <= 0) {
        cart.items.splice(existingItemIndex, 1); // Remove item if quantity is zero or less
      }
    } else {
      // Add a new item to the cart or replace an existing variant
      if (variantTypeId) {
        const sameProductDifferentVariantIndex = cart.items.findIndex(
          (item) =>
            item.productId.equals(productId) &&
            !item.variantTypeId.equals(variantTypeId)
        );

        if (sameProductDifferentVariantIndex >= 0) {
          cart.items.splice(sameProductDifferentVariantIndex, 1); // Remove existing item with different variant
        }
      }

      if (quantity > 0) {
        const newItem = {
          productId,
          quantity,
          price,
          totalPrice: totalPriceForItem,
          variantTypeId: variantTypeId || null, // Handle variantTypeId if it's not provided
        };
        cart.items.push(newItem);
      }
    }

    // Calculate total price for the cart
    cart.totalPrice = cart.items.reduce(
      (total, item) => total + item.totalPrice,
      0
    );

    // Save the cart and return the updated cart
    await cart.save();

    // If all items are removed, delete the cart
    if (cart.items.length === 0) {
      await CustomerCart.findByIdAndDelete(cart._id);
      return res
        .status(200)
        .json({ message: "Cart is empty and has been deleted" });
    }

    res.status(200).json({
      success: "Cart updated successfully",
      data: cart,
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
      deliveryMode,
      instructionToMerchant,
      instructionToDeliveryAgent,
      addedTip,
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

    if (addressType === "home") {
      deliveryCoordinates = customer.customerDetails.homeAddress.coordinates;
    } else if (addressType === "work") {
      deliveryCoordinates = customer.customerDetails.workAddress.coordinates;
    } else {
      const otherAddress = customer.customerDetails.otherAddress.find(
        (addr) => addr._id.toString() === addressType
      );
      if (otherAddress) {
        deliveryCoordinates = otherAddress.coordinates;
      } else {
        return res.status(404).json({ error: "Address not found" });
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

    let updatedCartDetails;

    if (deliveryMode === "Takeaway") {
      updatedCartDetails = {
        pickupLocation: pickupCoordinates,
        deliveryLocation: pickupCoordinates,
        deliveryMode,
        instructionToMerchant,
        instructionToDeliveryAgent,
        addedTip,
        startDate,
        endDate,
        time,
        distance: 0,
      };
    } else {
      updatedCartDetails = {
        pickupLocation: pickupCoordinates,
        deliveryLocation: deliveryCoordinates,
        deliveryMode,
        instructionToMerchant,
        instructionToDeliveryAgent,
        addedTip,
        startDate,
        endDate,
        time,
        distance: 0,
      };

      // Calculate distance using MapMyIndia API
      const distanceFromPickupToDelivery =
        await getDistanceFromPickupToDelivery(
          pickupCoordinates,
          deliveryCoordinates
        );

      updatedCartDetails.distance = distanceFromPickupToDelivery;
    }

    cart.cartDetails = updatedCartDetails;

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
      updatedCartDetails.distance,
      baseFare,
      baseDistance,
      fareAfterBaseDistance
    );

    updatedCartDetails.originalDeliveryCharge = deliveryCharges.toFixed(2);

    cart.cartDetails = updatedCartDetails;

    const itemTotal = cart.items.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );

    const taxAmount = await getTaxAmount(
      businessCategoryId,
      merchant.merchantDetail.geofenceId,
      itemTotal,
      deliveryCharges
    );

    const grandTotal = (
      itemTotal +
      parseFloat(deliveryCharges) +
      parseFloat(addedTip) +
      parseFloat(taxAmount)
    ).toFixed(2);

    cart.originalGrandTotal = parseFloat(grandTotal);

    await cart.save();

    res.status(200).json({
      success: "Delivery address and details added to cart successfully",
      data: cart,
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
    const totalCartPrice = cart.totalCartPrice;
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
      if (cart.cartDetails.deliveryCharge) {
        cart.cartDetails.deliveryCharge -= discountAmount;
        if (cart.cartDetails.deliveryCharge < 0) {
          cart.cartDetails.deliveryCharge = 0;
        }
        updatedTotal -= discountAmount;
      }
    }

    // Ensure updated total is not negative
    if (updatedTotal < 0) {
      updatedTotal = 0;
    }

    // Update cart and save
    cart.cartDetails.discountedDeliveryCharge =
      cart.cartDetails.originalDeliveryCharge - discountAmount;
    cart.discountedGrandTotal = cart.originalGrandTotal - discountAmount;
    promoCodeFound.noOfUserUsed += 1;
    await promoCodeFound.save();
    await cart.save();

    res.status(200).json({
      success: "Promo code applied successfully",
      data: {
        cart,
        promocodeApplied: discountAmount,
      },
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
};
