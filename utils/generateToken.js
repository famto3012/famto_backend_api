const jwt = require("jsonwebtoken");

const generateToken = (id, role, name, expiresIn = "20d") => {
  return jwt.sign({ id, role, name }, process.env.JWT_SECRET_KEY, {
    expiresIn,
  });
};

module.exports = generateToken;
