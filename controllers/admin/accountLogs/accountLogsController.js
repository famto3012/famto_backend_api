const moment = require("moment");
const AccountLogs = require("../../../models/AccountLogs");
const Agent = require("../../../models/Agent");
const Customer = require("../../../models/Customer");
const Merchant = require("../../../models/Merchant");
const appError = require("../../../utils/appError");

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

const unBlockUserController = async (req, res, next) => {
  try {
    const userLog = await AccountLogs.findById(req.params.id);

    if (!userLog) {
      return next(appError("User not found in logs", 404));
    }

    let user;
    if (userLog.role === "Merchant") {
      user = await Merchant.findById(userLog.userId); // Assuming userId stores the Merchant's ID
      if (!user) return next(appError("Merchant not found", 404));

      await Merchant.findByIdAndUpdate(userLog.userId, {
        isBlocked: false,
        reasonForBlockingOrDeleting: null,
        blockedDate: null,
      });
    } else if (userLog.role === "Agent") {
      user = await Agent.findById(userLog.userId); // Assuming userId stores the Agent's ID
      if (!user) return next(appError("Agent not found", 404));

      await Agent.findByIdAndUpdate(userLog.userId, {
        isBlocked: false,
        reasonForBlockingOrDeleting: null,
        blockedDate: null,
      });
    } else {
      user = await Customer.findById(userLog.userId); // Assuming userId stores the Customer's ID
      if (!user) return next(appError("Customer not found", 404));

      await Customer.findByIdAndUpdate(userLog.userId, {
        isBlocked: false,
        reasonForBlockingOrDeleting: null,
        blockedDate: null,
      });
    }

    // After updating the user, delete the log entry
    await AccountLogs.findByIdAndDelete(req.params.id);

    res.status(200).json({ message: "User unblocked successfully" });
  } catch (err) {
    console.error("Error unblocking user:", err); // Logs the error for debugging
    next(appError(err.message, 500)); // Include status code
  }
};

module.exports = {
  searchUserByRoleController,
  searchUserByNameController,
  searchUserByDateController,
  unBlockUserController,
};
