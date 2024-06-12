const appError = (message, statusCode) => {
  let err = new Error(message);
  err.statusCode = statusCode ? statusCode : 500;
  err.stack = err.stack;

  return err;
};

module.exports = appError;
