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
} = require("../../utils/customerAppHelpers");

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

    let newOtherAddresses = [];

    addresses.forEach((address) => {
      const { type, fullName, phoneNumber, flat, area, landmark } = address;

      const updatedAddress = {
        fullName,
        phoneNumber,
        flat,
        area,
        landmark,
      };

      switch (type) {
        case "home":
          currentCustomer.customerDetails.homeAddress = updatedAddress;
          break;
        case "work":
          currentCustomer.customerDetails.workAddress = updatedAddress;
          break;
        case "other":
          newOtherAddresses.push(updatedAddress);
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

const listRestaurantsController = async (req, res, next) => {
  const { latitude, longitude } = req.body;

  try {
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

    // Extracting required fields from filtered merchants including distance
    const simplifiedMerchants = sortedMerchants.map((merchant) => {
      const merchantLocation = merchant.merchantDetail.location;
      const distance = turf
        .distance(turf.point(merchantLocation), turf.point(customerLocation), {
          units: "kilometers",
        })
        .toFixed(2);

      return {
        _id: merchant._id,
        merchantName: merchant.merchantDetail.merchantName,
        preparationTime: merchant.merchantDetail.deliveryTime,
        description: merchant.merchantDetail.description,
        averageRating: merchant.merchantDetail.averageRating,
        status: merchant.status,
        distanceInKM: parseFloat(distance),
        merchantFoodType: merchant.merchantDetail.merchantFoodType || "N/A",
        merchantImageURL: merchant.merchantDetail.merchantImageURL,
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

const getMerchantWithCategoriesAndProductsController = async (
  req,
  res,
  next
) => {
  try {
    const { merchantId } = req.params;

    const merchantFound = await Merchant.findOne({
      _id: merchantId,
      isApproved: "Approved",
    });

    if (!merchantFound) {
      return next(appError("Merchant not found", 404));
    }

    const categoriesOfMerchant = await Category.find({ merchantId })
      .select("_id categoryName order")
      .sort({ order: 1 });

    const categoriesWithProducts = await Promise.all(
      categoriesOfMerchant.map(async (category) => {
        const products = await Product.find({ categoryId: category._id })
          .select("_id productName price description productImageURL")
          .sort({ order: 1 });
        return {
          ...category._doc,
          products,
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
      .select("_id productName price description")
      .sort({ order: 1 });

    res.status(200).json({
      message: "Products found in merchant",
      data: products,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const filterProductsByTypeController = async (req, res, next) => {
  try {
    const { merchantId } = req.params;
    const { type } = req.query; // Type can be "Veg" or "Non-veg" only

    // Find categories belonging to the merchant
    const categories = await Category.find({ merchantId });

    // Extract category IDs
    const categoryIds = categories.map((category) => category._id);

    // Filter products by type within the categories
    const products = await Product.find({
      categoryId: { $in: categoryIds },
      type: type, // Only filter by the specified type
    })
      .select("_id productName price description")
      .sort({ order: 1 });

    res.status(200).json({
      message: `Products filtered by ${type} type`,
      data: products,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const filterProductByFavouriteController = async (req, res, next) => {
  try {
    const currentCustomer = req.userAuth;
    const { merchantId } = req.params;

    if (!currentCustomer) {
      return next(appError("Customer is not authenticated", 403));
    }

    const customer = await Customer.findById(currentCustomer).populate({
      path: "customerDetails.favouriteProducts",
      select: "_id productName price description productImageURL",
      populate: {
        path: "categoryId",
        match: { merchantId: merchantId },
        select: "_id merchantId",
      },
    });

    if (!customer) {
      return next(appError("Customer not found", 404));
    }

    const favoriteProducts = customer.customerDetails.favouriteProducts.filter(
      (product) =>
        product.categoryId &&
        product.categoryId.merchantId.toString() === merchantId
    );

    res.status(200).json({
      message: "Favorite products retrieved successfully",
      data: favoriteProducts,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

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

    const isFavourite =
      currentCustomer.customerDetails.favouriteProducts.includes(productId);

    if (isFavourite) {
      currentCustomer.customerDetails.favouriteProducts =
        currentCustomer.customerDetails.favouriteProducts.filter(
          (favourite) => favourite.toString() !== productId.toString()
        );

      await currentCustomer.save();

      res.status(200).json({
        message: "successfully removed product from favourite list",
      });
    } else {
      currentCustomer.customerDetails.favouriteProducts.push(productId);
      await currentCustomer.save();

      res.status(200).json({
        message: "successfully added product to favourite list",
      });
    }
  } catch (err) {
    next(appError(err.message));
  }
};

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

    const isFavourite =
      currentCustomer.customerDetails.favouriteMerchants.includes(merchantId);

    if (isFavourite) {
      currentCustomer.customerDetails.favouriteMerchants =
        currentCustomer.customerDetails.favouriteMerchants.filter(
          (favourite) => favourite.toString() !== merchantId.toString()
        );

      await currentCustomer.save();

      res.status(200).json({
        message: "successfully removed merchant from favourite list",
      });
    } else {
      currentCustomer.customerDetails.favouriteMerchants.push(merchantId);
      await currentCustomer.save();

      res.status(200).json({
        message: "successfully added merchant to favourite list",
      });
    }
  } catch (err) {
    next(appError(err.message));
  }
};

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
  filterProductsByTypeController,
  toggleProductFavoriteController,
  toggleMerchantFavoriteController,
  filterProductByFavouriteController,
  addRatingToMerchantController,
};
