const appError = require("../../utils/appError");

const registerController = (req, res, next) => {
  try {
    res.status(200).json({ message: "register Controller" });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = { registerController };
