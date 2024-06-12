const express = require("express");
const cors = require("cors");

const globalErrorHandler = require("./middlewares/globalErrorHandler");

require("dotenv").config();
require("./config/dbConnect");

const app = express();

//middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: "*",
    methods: ["*"],
  })
);

//routers

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
