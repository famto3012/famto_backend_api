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

// const searchUserByDateController = async(req,res,next)=>{
//     try{
//         const {date} = req.query

//         let user = await AccountLogs.find({createdAt: date})

//         res.status(200).json({
//             message: "Data fetched successfully",
//             data: user
//         })
//     }catch(err){
//         next(appError(err.message))
//     }
// }

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
    const userFound = await AccountLogs.findById(req.params.id);

    if (!userFound) {
      return next(appError("User not found", 404));
    }

    if (userFound.role === "Merchant") {
      await Merchant.findByIdAndUpdate(req.params.id, {
        isBlocked: false,
        reasonForBlockingOrDeleting: null,
        blockedDate: null,
      });
      await AccountLogs.findByIdAndDelete(req.params.id);
    } else if (userFound.role === "Agent") {
      await Agent.findByIdAndUpdate(req.params.id, {
        isBlocked: false,
        reasonForBlockingOrDeleting: null,
        blockedDate: null,
      });
      await AccountLogs.findByIdAndDelete(req.params.id);
    } else {
      await Customer.findByIdAndUpdate(req.params.id, {
        isBlocked: false,
        reasonForBlockingOrDeleting: null,
        blockedDate: null,
      });
      await AccountLogs.findByIdAndDelete(req.params.id);
    }

    res.status(200).json({ message: "User unblocked successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  searchUserByRoleController,
  searchUserByNameController,
  searchUserByDateController,
  unBlockUserController,
};
