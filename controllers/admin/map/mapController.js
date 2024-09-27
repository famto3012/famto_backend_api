const axios = require("axios");

const getPolylineController = async (req, res) => {
  const { pickupLat, pickupLng, deliveryLat, deliveryLng } = req.body;
  const url = `https://apis.mapmyindia.com/advancedmaps/v1/9a632cda78b871b3a6eb69bddc470fef/route_adv/biking/${pickupLng},${pickupLat};${deliveryLng},${deliveryLat}?geometries=geojson`;

  try {
    const response = await axios.get(url);
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch data from Mappls API" });
  }
};

module.exports = { getPolylineController };
