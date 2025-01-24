const getTokenFromHeader = require("../utils/getTokenFromHeaders");
const verifyToken = require("../utils/verifyToken");
const appError = require("../utils/appError");
const ManagerRoles = require("../models/ManagerRoles");

const isAdminOrMerchant = async (req, res, next) => {
  try {
    const token = getTokenFromHeader(req);
    if (!token) {
      return next(appError("Token not provided", 401));
    }

    const decodedUser = verifyToken(token);

    req.userAuth = decodedUser.id;
    req.userRole = decodedUser.role;
    req.userName = decodedUser.name;

    console.log("decodedUser: ", decodedUser);

    const roleExists = await ManagerRoles.findOne({
      roleName: decodedUser.role.roleName,
    });

    console.log("roleExists: ", roleExists);

    if (
      decodedUser.role === "Admin" ||
      decodedUser.role === "Merchant" ||
      roleExists
    ) {
      return next();
    }

    return next(appError("Access denied", 403));
  } catch (error) {
    return next(appError(error.message, 500));
  }
};

module.exports = isAdminOrMerchant;
