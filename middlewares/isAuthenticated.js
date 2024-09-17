const appError = require("../utils/appError");
const getTokenFromHeader = require("../utils/getTokenFromHeaders");
const verifyToken = require("../utils/verifyToken");

const isAuthenticated = (req, res, next) => {
  const token = getTokenFromHeader(req);

  console.log("token", token);

  const decodedUser = verifyToken(token);

  console.log("decodedUser", decodedUser);
  req.userAuth = decodedUser.id;

  if (!decodedUser) {
    return next(appError("Invalid / Expired token"));
  } else {
    next();
  }
};

module.exports = isAuthenticated;
