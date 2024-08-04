const axios = require("axios");
const appError = require("../../utils/appError");
const Token = require("../../models/Token");

const generateMapplsAuthToken = async () => {
  try {
    console.log(`Generating auth token for mappls Token`);

    const response = await axios.post(
      `https://outpost.mappls.com/api/security/oauth/token?grant_type=client_credentials&client_id=${process.env.MAPPLS_CLIENT_ID}&client_secret=${process.env.MAPPLS_CLIENT_SECRET}`
    );

    if (response.status === 200) {
      const { access_token } = response.data;

      await Token.findOneAndUpdate(
        {},
        { mapplsAuthToken: access_token },
        { new: true, upsert: true }
      );

      console.log(`Token updated successfully`);
    } else {
      console.error("Failed to retrieve access token");
    }
  } catch (error) {
    console.error("Error generating access token:", error);
  }
};

const getAuthToken = async (req, res, next) => {
  try {
    const tokenFound = await Token.findOne({});

    if (!tokenFound.mapplsAuthToken) {
      return next(appError("Token not found", 404));
    }

    res.status(200).json({
      data: tokenFound.mapplsAuthToken,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = { generateMapplsAuthToken, getAuthToken };
