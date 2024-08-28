const express = require("express");
const { getPolylineController } = require("../../../controllers/admin/map/mapController");
const mapRoute = express.Router();

mapRoute.post(
  "/get-polyline",
  getPolylineController
);

module.exports = mapRoute;
