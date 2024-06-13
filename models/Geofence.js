const mongoose = require("mongoose");

const geofenceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    coordinates: {
      type: [[Number]],
      required: true,
    },
    color: {
      type: String,
      required: true,
    },
    manager: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true,
  }
);

const Geofence = mongoose.model("Geofence", geofenceSchema);
module.exports = Geofence;
