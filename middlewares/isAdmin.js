const Admin = require("../models/Admin");
const getTokenFromHeader = require("../utils/getTokenFromHeaders");
const verifyToken = require("../utils/verifyToken");
const appError = require("../utils/appError")

const isAdmin = async (req, res, next) => {
  //Get token from header
  const token = getTokenFromHeader(req);
  //Verify the token
  const decodedUser = verifyToken(token);

  //Save the user into req object
  req.userAuth = decodedUser.id;

  //Find the user in DB
  const user = await Admin.findById(decodedUser.id);
  //Check if the user is Admin or not
  if (user.role === "Admin") {
    return next();
  } else {
    return next(appError("Access denied, Admin only!", 403));
  }
};

module.exports = isAdmin;
