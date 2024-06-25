const Customer = require("../../../models/Customer");
const appError = require("../../../utils/appError");
const formatDate = require("../../../utils/formatDate");

const getAllCustomersController = async (req, res, next) => {
  try {
    const allCustomers = await Customer.find({})
      .select(
        "fullName email phoneNumber lastPlatformUsed createdAt customerDetails"
      )
      .lean({ virtuals: true });

    // Calculate averageRating and format registrationDate for each customer
    const formattedCustomers = allCustomers.map((customer) => {
      return {
        _id: customer._id,
        fullName: customer.fullName || "N/A",
        email: customer.email || "N/A",
        phoneNumber: customer.phoneNumber || "N/A",
        lastPlatformUsed: customer.lastPlatformUsed,
        registrationDate: formatDate(customer.createdAt),
        averageRating: customer.customerDetails?.averageRating || 0,
      };
    });

    res.status(200).json({
      message: "All customers",
      data: formattedCustomers,
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
      fullName: { $regex: searchTerm, $options: "i" },
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
        "fullName email phoneNumber lastPlatformUsed createdAt customerDetails"
      )
      .lean({ virtuals: true });

    if (!customerFound) {
      return next(appError("Customer not found", 404));
    }

    const formattedCustomer = {
      _id: customerFound._id,
      fullName: customerFound.fullName || "N/A",
      email: customerFound.email || "N/A",
      phoneNumber: customerFound.phoneNumber,
      lastPlatformUsed: customerFound.lastPlatformUsed,
      registrationDate: formatDate(customerFound.createdAt),
      homeAddress: customerFound.customerDetails?.homeAddress || "N/A",
      workAddress: customerFound.customerDetails?.workAddress || "N/A",
      otherAddress: customerFound.customerDetails?.otherAddress || "N/A",
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

    customerFound.customerDetails.isBlocked = true;
    customerFound.customerDetails.reasonForBlockingOrDeleting = reason;
    customerFound.customerDetails.blockedDate = new Date();

    await customerFound.save();

    res.status(200).json({ message: "Customer blocked successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

const unBlockCustomerController = async (req, res, next) => {
  try {
    const customerFound = await Customer.findById(req.params.customerId);

    if (!customerFound) {
      return next(appError("Customer not found", 404));
    }

    customerFound.customerDetails.isBlocked = false;
    customerFound.customerDetails.reasonForBlockingOrDeleting = null;
    customerFound.customerDetails.blockedDate = null;

    await customerFound.save();

    res.status(200).json({ message: "Customer unblocked successfully" });
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

    res.status(200).josn({ message: "Customer updated successfully" });
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
};
