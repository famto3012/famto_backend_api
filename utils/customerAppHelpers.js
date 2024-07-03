const axios = require("axios");
const Tax = require("../models/Tax");
const appError = require("./appError");

// Helper function to sort merchants by sponsorship
const sortMerchantsBySponsorship = (merchants) => {
  return merchants.sort((a, b) => {
    const aSponsorship = a.sponsorshipDetail.some((s) => s.sponsorshipStatus);
    const bSponsorship = b.sponsorshipDetail.some((s) => s.sponsorshipStatus);
    return bSponsorship - aSponsorship;
  });
};

const getDistanceFromPickupToDelivery = async (
  pickupCoordinates,
  deliveryCoordinates
) => {
  const { data } = await axios.get(
    `https://apis.mapmyindia.com/advancedmaps/v1/${process.env.MapMyIndiaAPIKey}/distance_matrix_eta/biking/${pickupCoordinates[1]},${pickupCoordinates[0]};${deliveryCoordinates[1]},${deliveryCoordinates[0]}`
  );

  if (
    data &&
    data.results &&
    data.results.distances &&
    data.results.distances.length > 0
  ) {
    const distanceInKm = data.results.distances[0][1] / 1000; // Distance in kilometers

    const fixedDistance = distanceInKm.toFixed(2);

    return fixedDistance;
  }
};

const calculateDeliveryCharges = (
  distance,
  baseFare,
  baseDistance,
  fareAfterBaseDistance
) => {
  if (distance <= baseDistance) {
    return baseFare;
  } else {
    return baseFare + (distance - baseDistance) * fareAfterBaseDistance;
  }
};

const getTaxAmount = async (
  businessCategoryId,
  geofenceId,
  itemTotal,
  deliveryCharges
) => {
  try {
    const taxFound = await Tax.findOne({
      assignToBusinessCategoryId: businessCategoryId,
      geofenceId,
    });

    if (!taxFound) {
      return next(appError("Tax not found", 404));
    }

    const taxPercentage = taxFound.tax;

    const taxAmount =
      ((parseFloat(itemTotal) + parseFloat(deliveryCharges)) * taxPercentage) /
      100;

    return parseFloat(taxAmount.toFixed(2));
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  sortMerchantsBySponsorship,
  getDistanceFromPickupToDelivery,
  calculateDeliveryCharges,
  getTaxAmount,
};
