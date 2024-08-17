const Geofence = require("../models/Geofence");
const appError = require("./appError");
const { point, polygon, booleanPointInPolygon, area } = require("@turf/turf");

// Function to find the appropriate geofence for given coordinates
const geoLocation = async (latitude, longitude, next) => {
  try {
    // Retrieve all geofences (assuming you have a Geofence model)
    const geofences = await Geofence.find({}); // Adjust this based on your actual model name

    // Convert user coordinates into a Turf.js point
    const userPoint = point([longitude, latitude]);

    let largestArea = 0;
    let largestGeofence = null;

    // Iterate through each geofence and check if userPoint is inside
    for (let i = 0; i < geofences.length; i++) {
      const coords = geofences[i].coordinates.map((coord) => [
        coord[1],
        coord[0],
      ]);
      const geoPolygon = polygon([coords]);

      if (booleanPointInPolygon(userPoint, geoPolygon)) {
        const currentArea = area(geoPolygon);
        // If a larger area is found, update the largestGeofence
        if (currentArea > largestArea) {
          largestArea = currentArea;
          largestGeofence = geofences[i];
        }
        // If the area is the same as the largestArea, keep the first one found
        else if (currentArea === largestArea && !largestGeofence) {
          largestGeofence = geofences[i];
        }
      }
    }

    // Return the geofence with the largest area or null if no matching geofence is found
    return largestGeofence || null;
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = geoLocation;
