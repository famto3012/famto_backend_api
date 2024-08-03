const mongoose = require("mongoose");

const geofenceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
      required: true,
      unique: true,
    },
    coordinates: {
      type: [[Number]],
      required: true,
      unique: true,
    },
    color: {
      type: String,
      required: true,
      unique: true,
    },
    orderManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Manager",
      default: null,
    },
    //TODO: other manager
    // otherManager: [{
    //   type:  mongoose.Schema.Types.ObjectId,
    //   ref: "Manager"
    //}]
  },
  {
    timestamps: true,
  }
);

const Geofence = mongoose.model("Geofence", geofenceSchema);
module.exports = Geofence;
