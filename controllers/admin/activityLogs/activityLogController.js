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

const deleteOldActivityLogs = async () => {
  try {
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    await ActivityLog.deleteMany({
      createdAt: { $lt: tenDaysAgo },
    });
  } catch (err) {
    throw new Error(`Error in deleting old activity logs: ${err}`);
  }
};

module.exports = {
  getAllActivityLogsController,
  deleteOldActivityLogs,
};
