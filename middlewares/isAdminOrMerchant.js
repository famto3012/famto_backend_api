const getTokenFromHeader = require("../utils/getTokenFromHeaders");
const verifyToken = require("../utils/verifyToken");
const appError = require("../utils/appError");

const isAdminOrMerchant = async (req, res, next) => {
  //Get token from header
  const token = getTokenFromHeader(req);
  //Verify the token
  const decodedUser = verifyToken(token);

  //Save the user's id and role into req object
  req.userAuth = decodedUser.id;
  req.userRole = decodedUser.role;

  //Check if the user is Admin or Merchant
  if (decodedUser.role === "Admin" || decodedUser.role === "Merchant") {
    return next();
  } else {
    return next(appError("Access denied", 403));
  }
};

module.exports = isAdminOrMerchant;
