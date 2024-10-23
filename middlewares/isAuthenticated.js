const appError = require("../utils/appError");
const getTokenFromHeader = require("../utils/getTokenFromHeaders");
const verifyToken = require("../utils/verifyToken");

const isAuthenticated = (req, res, next) => {
  const token = getTokenFromHeader(req);

  const decodedUser = verifyToken(token);

  req.userAuth = decodedUser.id;
  req.userRole = decodedUser.role;

  if (!decodedUser) {
    return next(appError("Invalid / Expired token"));
  } else {
    next();
  }
};

module.exports = isAuthenticated;
