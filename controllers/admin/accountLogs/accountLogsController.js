const moment = require("moment");
const path = require("path");
const AccountLogs = require("../../../models/AccountLogs");
const Agent = require("../../../models/Agent");
const Customer = require("../../../models/Customer");
const Merchant = require("../../../models/Merchant");
const appError = require("../../../utils/appError");
const { formatDate, formatTime } = require("../../../utils/formatters");
const csvWriter = require("csv-writer").createObjectCsvWriter;

// TODO: remove after finishing Panel V2
const searchUserByRoleController = async (req, res, next) => {
  try {
    const { role } = req.query;

    let user = await AccountLogs.find({ role });

    res.status(200).json({
      message: "Data fetched successfully",
      data: user,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// TODO: remove after finishing Panel V2
const searchUserByNameController = async (req, res, next) => {
  try {
    const { name } = req.query;

    let user = await AccountLogs.find({
      fullName: { $regex: name, $options: "i" },
    });

    res.status(200).json({
      message: "Data fetched successfully",
      data: user,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

// TODO: remove after finishing Panel V2
const searchUserByDateController = async (req, res, next) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        message: "Date query parameter is required",
      });
    }

    // Parse the user-provided date using moment
    const inputDate = moment(date, moment.ISO_8601, true);

    // Check if the date is valid
    if (!inputDate.isValid()) {
      // Attempt to convert the invalid date format to a valid format
      const formattedDate = moment(date, "MM/DD/YYYY", true);

      // Check if the conversion to a valid format was successful
      if (!formattedDate.isValid()) {
        return res.status(400).json({
          message: "Invalid date format. Please use YYYY-MM-DD or MM/DD/YYYY.",
        });
      }

      inputDate = formattedDate;
    }

    // Get the start and end of the day
    const startOfDay = inputDate.startOf("day").toDate();
    const endOfDay = inputDate.endOf("day").toDate();

    // Query the database for records within the start and end of the day
    let users = await AccountLogs.find({
      createdAt: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    });

    res.status(200).json({
      message: "Data fetched successfully",
      data: users,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const filterUserInAccountLogs = async (req, res, next) => {
  try {
    const { role, query, date } = req.query;

    const filterCriteria = {};

    if (role) {
      filterCriteria.role = role;
    }

    if (query) {
      filterCriteria.fullName = { $regex: query.trim(), $options: "i" };
    }

    if (date) {
      const formattedStartDate = new Date(date);
      formattedStartDate.setHours(0, 0, 0, 0);
      const formattedEndDate = new Date(date);
      formattedEndDate.setHours(23, 59, 59, 999);

      filterCriteria.createdAt = {
        $gte: formattedStartDate,
        $lte: formattedEndDate,
      };
    }

    const logs = await AccountLogs.find(filterCriteria).sort({ createdAt: -1 });

    const formattedResponse = logs.map((log) => ({
      logId: log._id,
      userId: log.userId,
      role: log.role,
      fullName: log.fullName,
      description: log.description,
      blockedDate: formatDate(log.createdAt),
      blockedTime: formatTime(log.createdAt),
      status: true,
    }));

    res.status(200).json(formattedResponse);
  } catch (err) {
    next(appError(err.message));
  }
};

const unBlockUserController = async (req, res, next) => {
  try {
    const userLog = await AccountLogs.findById(req.params.logId);

    if (!userLog) return next(appError("User not found in logs", 404));

    const userModels = {
      Merchant,
      Agent,
      Customer,
    };

    const userModel = userModels[userLog.role];
    if (!userModel) return next(appError("Invalid role specified", 400));

    const user = await userModel.findById(userLog.userId);
    if (!user) return next(appError(`${userLog.role} not found`, 404));

    const updateData =
      userLog.role === "Customer"
        ? {
            "customerDetails.isBlocked": false,
            "customerDetails.reasonForBlockingOrDeleting": null,
            "customerDetails.blockedDate": null,
          }
        : {
            isBlocked: false,
            reasonForBlockingOrDeleting: null,
            blockedDate: null,
          };

    await Promise.all([
      userModel.findByIdAndUpdate(userLog.userId, updateData),
      AccountLogs.findByIdAndDelete(req.params.logId),
    ]);

    res.status(200).json({ message: "User unblocked successfully" });
  } catch (err) {
    console.error("Error unblocking user:", err);
    next(appError(err.message, 500));
  }
};

const downloadUserCSVInAccountLogs = async (req, res, next) => {
  try {
    const { role, query, date } = req.query;

    const filterCriteria = {};

    if (role) {
      filterCriteria.role = role;
    }

    if (query) {
      filterCriteria.fullName = { $regex: query.trim(), $options: "i" };
    }

    if (date) {
      const formattedStartDate = new Date(date);
      formattedStartDate.setHours(0, 0, 0, 0);
      const formattedEndDate = new Date(date);
      formattedEndDate.setHours(23, 59, 59, 999);

      filterCriteria.createdAt = {
        $gte: formattedStartDate,
        $lte: formattedEndDate,
      };
    }

    const logs = await AccountLogs.find(filterCriteria).sort({ createdAt: -1 });

    const formattedResponse = logs.map((log) => ({
      userId: log.userId,
      role: log.role,
      fullName: log.fullName,
      description: log.description,
      blockedDate: formatDate(log.createdAt),
      blockedTime: formatTime(log.createdAt),
    }));

    const filePath = path.join(__dirname, "../../../Account_logs.csv");

    const csvHeaders = [
      { id: "userId", title: "User ID" },
      { id: "role", title: "Role" },
      { id: "fullName", title: "Full Name" },
      { id: "description", title: "Description" },
      { id: "blockedDate", title: "Blocked Date" },
      { id: "blockedTime", title: "Blocked Time" },
    ];

    const writer = csvWriter({
      path: filePath,
      header: csvHeaders,
    });

    await writer.writeRecords(formattedResponse);

    res.status(200).download(filePath, "Account_Log.csv", (err) => {
      if (err) {
        next(err);
      } else {
        fs.unlink(filePath, (unlinkErr) => {
          if (unlinkErr) {
            console.error("File deletion error:", unlinkErr);
          }
        });
      }
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  searchUserByRoleController,
  searchUserByNameController,
  searchUserByDateController,
  filterUserInAccountLogs,
  downloadUserCSVInAccountLogs,
  unBlockUserController,
};
