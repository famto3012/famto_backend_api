const AdminNotificationLogs = require("../../../../models/AdminNotificationLog");
const MerchantNotificationLogs = require("../../../../models/MerchantNotificationLog");
const appError = require("../../../../utils/appError");

const getAdminNotificationLogController = async (req, res, next) => {
  try {
    // Get page and limit from query parameters with default values
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Find documents with pagination
    const adminNotificationLog = await AdminNotificationLogs.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get the total count of documents
    const totalDocuments = await AdminNotificationLogs.countDocuments();

    // Calculate total pages
    const totalPages = Math.ceil(totalDocuments / limit);

    res.status(200).json({
      data: adminNotificationLog,
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

const getMerchantNotificationLogController = async (req, res, next) => {
  try {
    // Get page and limit from query parameters with default values
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const merchantId = req.userAuth;

    // Find documents with pagination
    const merchantNotificationLog = await MerchantNotificationLogs.find({
      merchantId,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get the total count of documents
    const totalDocuments = await MerchantNotificationLogs.countDocuments({
      merchantId,
    });

    // Calculate total pages
    const totalPages = Math.ceil(totalDocuments / limit);

    res.status(200).json({
      data: merchantNotificationLog,
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

module.exports = {
  getAdminNotificationLogController,
  getMerchantNotificationLogController,
};
