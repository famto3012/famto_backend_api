const moment = require("moment");

const formatDate = (date) => {
  const options = {
    day: "2-digit",
    month: "short",
    year: "numeric",
  };

  const formatedDate = new Date(date).toLocaleDateString("en-GB", options);

  return formatedDate;
};

const formatTime = (createdAt) => {
  const date = new Date(createdAt);

  let hours = date.getHours();
  const minutes = ("0" + date.getMinutes()).slice(-2);
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // Handle midnight (0 hours)

  const formattedTime = `${hours}:${minutes} ${ampm}`;

  return formattedTime;
};

const convertToUTC = (time12hr) => {
  // Parse the 12-hour time using a known format
  const localTime = moment(time12hr, "hh:mm A");

  // Convert to UTC
  const utcTime = localTime.utc();

  // Return the UTC time in desired format
  return utcTime.format();
};

module.exports = { formatDate, formatTime, convertToUTC };
