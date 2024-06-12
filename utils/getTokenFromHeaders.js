const getTokenFromHeader = (req) => {
  const headerObject = req.headers;
  const token = headerObject["authorization"].split(" ")[1];

  if (token !== undefined) {
    return token;
  } else {
    return false;
  }
};

module.exports = getTokenFromHeader;
