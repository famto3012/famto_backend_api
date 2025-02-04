const getTokenFromHeader = require("../utils/getTokenFromHeaders");
const verifyToken = require("../utils/verifyToken");

const isLooselyAuthenticated = (req, res, next) => {
  const token = getTokenFromHeader(req);

  const decodedUser = verifyToken(token);

  req.userAuth = decodedUser.id;
  req.userRole = decodedUser.role;

  next();
};

module.exports = isLooselyAuthenticated;
