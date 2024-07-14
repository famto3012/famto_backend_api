const moment = require("moment");
const momentTimezone = require("moment-timezone");

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

const convertToUTC = (date, time) => {
  // Combine date and time
  const localDateTime = momentTimezone.tz(
    `${date} ${time}`,
    "YYYY-MM-DD hh:mm A",
    momentTimezone.tz.guess()
  );

  // Convert to UTC
  const timeUTC = localDateTime.clone().utc();

  console.log("Time in function: ", timeUTC.format());
  // Return the UTC time in desired format
  return timeUTC.format();
};

const convertStartDateToUTC = (date, time) => {
  // Combine date and time
  const localDateTime = momentTimezone.tz(
    `${date} ${time}`,
    "YYYY-MM-DD hh:mm A",
    momentTimezone.tz.guess()
  );

  // Convert to UTC
  const orderStartDateinUTC = localDateTime.clone().utc();

  console.log(
    "Start date in function: ",
    orderStartDateinUTC.startOf("day").format()
  );
  // Return the UTC time in desired format
  return orderStartDateinUTC.startOf("day").format();
};

const convertEndDateToUTC = (date, time) => {
  // Combine date and time
  const localDateTime = momentTimezone.tz(
    `${date} ${time}`,
    "YYYY-MM-DD hh:mm A",
    momentTimezone.tz.guess()
  );

  // Convert to UTC
  const orderEndDateInUTC = localDateTime.clone().utc();

  console.log("End date in function: ", orderEndDateInUTC.format());

  // Return the UTC time in desired format
  return orderEndDateInUTC.format();
};

module.exports = {
  formatDate,
  formatTime,
  convertToUTC,
  convertStartDateToUTC,
  convertEndDateToUTC,
};
