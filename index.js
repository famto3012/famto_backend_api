const express = require("express");
// const cookieParser = require("cookie-parser");
const cors = require("cors");

const globalErrorHandler = require("./middlewares/globalErrorHandler");

const categoryRoute = require("./routes/categoryRoute/categoryRoute");
const authRoute = require("./routes/authRoute/authRoute");
const merchantRoute = require("./routes/merchantRoute/merchantRoute");
const productRoute = require("./routes/productRoute/productRoute");
const customerRoute = require("./routes/customerRoute/customerRoute");

require("dotenv").config();
require("./config/dbConnect");

const app = express();

//middlewares
app.use(express.json());
// app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

//routers
app.use("/api/v1/categories", categoryRoute);
app.use("/api/v1/auth", authRoute);
app.use("/api/v1/merchants", merchantRoute);
app.use("/api/v1/products", productRoute);
app.use("/api/v1/customers", customerRoute);

//global errors
app.use(globalErrorHandler);

//404 Error
app.use("*", (req, res) => {
  res.status(404).json({
    message: `${req.originalUrl} - Path not found`,
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server runnning on http://localhost:${PORT}`);
});
