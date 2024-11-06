const jwt = require("jsonwebtoken");

const generateToken = (id, role, expiresIn = "20d") => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET_KEY, {
    expiresIn,
  });
};

module.exports = generateToken;
