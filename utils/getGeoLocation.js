const Geofence = require("../models/Geofence");
const appError = require("./appError");
const { point, polygon, booleanPointInPolygon } = require("@turf/turf");

// Function to find the appropriate geofence for given coordinates
const geoLocation = async (latitude, longitude, next) => {
  try {
    // Retrieve all geofences (assuming you have a Geofence model)
    const geofences = await Geofence.find({}); // Adjust this based on your actual model name

    // Convert user coordinates into a Turf.js point
    const userPoint = point([longitude, latitude]);

    // Iterate through each geofence and check if userPoint is inside
    for (let i = 0; i < geofences.length; i++) {
      const coords = geofences[i].coordinates.map((coord) => [
        coord[1],
        coord[0],
      ]);
      const geoPolygon = polygon([coords]);

      if (booleanPointInPolygon(userPoint, geoPolygon)) {
        return geofences[i]; // Return the first matching geofence
      }
    }

    return null; // Return null if no matching geofence is found
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = geoLocation;
