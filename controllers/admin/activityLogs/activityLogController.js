const ActivityLog = require("../../../models/ActivityLog");
const appError = require("../../../utils/appError");
const { formatDate, formatTime } = require("../../../utils/formatters");

const getAllActivityLogsController = async (req, res, next) => {
  try {
    const allLogs = await ActivityLog.find({}).sort({ createdAt: -1 });

    const formattedResponse = allLogs?.map((logs) => ({
      date: formatDate(logs.createdAt),
      time: formatTime(logs.createdAt),
      description: logs.description,
    }));

    res.status(200).json(formattedResponse);
  } catch (err) {
    next(appError(err.message));
  }
};

const deleteOldActivityLogsController = async (req, res, next) => {
  try {
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    await ActivityLog.deleteMany({
      createdAt: { $lt: tenDaysAgo },
    });

    res.status(200).json({
      message: "Old activity logs deleted successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  getAllActivityLogsController,
  deleteOldActivityLogsController,
};
