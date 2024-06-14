const Geofence = require("../models/Geofence");
const appError = require("./appError");

const geoLocation = async (latitude, longitude, next) => {
  try {
    const location = [latitude, longitude];

    const geofence = await Geofence.findOne({
      coordinates: {
        $geoIntersects: {
          $geometry: {
            type: "Point",
            coordinates: location,
          },
        },
      },
    });

    if (!geofence) {
      throw new Error("No geofence found for this location");
    }

    return geofence._id;
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = geoLocation;
