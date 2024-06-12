const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const globalErrorHandler = require("./middlewares/globalErrorHandler");

const merchanrRoute = require("./routes/merchantRoute/merchantRoute");

require("dotenv").config();
require("./config/dbConnect");

const app = express();

//middlewares
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

//routers
app.use("/api/v1/merchants", merchanrRoute);

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
