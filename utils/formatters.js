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

// const convertToUTC = (date, time) => {
//   // Combine date and time
//   const localDateTime = momentTimezone.tz(
//     `${date} ${time}`,
//     "YYYY-MM-DD hh:mm A",
//     momentTimezone.tz.guess()
//   );

//   // Convert to UTC
//   const timeUTC = localDateTime.clone().utc();

//   console.log("Time in function: ", timeUTC.format());
//   // Return the UTC time in desired format
//   return timeUTC.format();
// };

const convertToUTC = (time12hr) => {
  // // Parse the 12-hour time using a known format
  // const localTime = moment(time12hr, "hh:mm A");

  // // Convert to UTC
  // const utcTime = localTime.utc();

  // // Return the UTC time in desired format
  // return utcTime.format();

  // ===================

  // Parse the 12-hour time using a known format
  const localTime = moment(time12hr, "hh:mm A");

  // Subtract one hour
  const adjustedTime = localTime.subtract(1, "hours");

  // Convert to UTC
  const utcTime = adjustedTime.utc();

  // Return the UTC time in desired format
  return utcTime.format();
};

const convertStartDateToUTC = (date, time) => {
  // Combine date and time using 12-hour format
  console.log(`Input date: ${date}, time: ${time}`);
  const localDateTime = momentTimezone.tz(
    `${date} ${time}`,
    "YYYY-MM-DD hh:mm A",
    momentTimezone.tz.guess()
  );

  // Log local date and time
  console.log("Local date and time: ", localDateTime.format());

  // Convert to UTC
  const orderStartDateinUTC = localDateTime.clone().utc();

  console.log("Start date in function (UTC): ", orderStartDateinUTC.format());
  // Return the UTC time in desired format
  return orderStartDateinUTC.format();
};

const convertEndDateToUTC = (date, time) => {
  // Combine date and time using 12-hour format
  console.log(`Input date: ${date}, time: ${time}`);
  const localDateTime = momentTimezone.tz(
    `${date} ${time}`,
    "YYYY-MM-DD hh:mm A",
    momentTimezone.tz.guess()
  );

  // Log local date and time
  console.log("Local date and time: ", localDateTime.format());

  // Convert to UTC
  const orderEndDateInUTC = localDateTime.clone().utc();

  console.log("End date in function (UTC): ", orderEndDateInUTC.format());

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
