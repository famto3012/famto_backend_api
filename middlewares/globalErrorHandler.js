const globalErrorHandler = (err, req, res, next) => {
  const message = err.message || "Internal Server Error";

  const status = err.status ? err.status : "Failed";
  const statusCode = err.statusCode ? err.statusCode : 500;

  const stack = err.stack;

  console.log(err.stack);
  res.status(statusCode).json({
    status,
    message,
    stack,
  });
};

module.exports = globalErrorHandler;
