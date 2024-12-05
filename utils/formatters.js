const moment = require("moment");
const momentTimezone = require("moment-timezone");

const formatDate = (date) => {
  try {
    return momentTimezone(date).tz("Asia/Kolkata").format("DD MMM YYYY");
  } catch (err) {
    return "-";
  }
};

const formatTime = (createdAt) => {
  try {
    return momentTimezone(createdAt).tz("Asia/Kolkata").format("hh:mm A");
  } catch (err) {
    return "-";
  }
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

// const convertToUTC = (time12hr) => {
//   // // Parse the 12-hour time using a known format
//   // const localTime = moment(time12hr, "hh:mm A");

//   // // Convert to UTC
//   // const utcTime = localTime.utc();

//   // // Return the UTC time in desired format
//   // return utcTime.format();

//   // ===================

//   // Parse the 12-hour time using a known format
//   const localTime = moment(time12hr, "hh:mm A");

//   // Subtract one hour
//   const adjustedTime = localTime.subtract(1, "hours");

//   // Convert to UTC
//   const utcTime = adjustedTime.utc();

//   // Return the UTC time in desired format
//   return utcTime.format();
// };

const convertToUTC = (time12hr, startDate) => {
  // Parse the 12-hour time using a known format (e.g., "hh:mm A" for 12-hour format with AM/PM)
  const localTime = moment(time12hr, "hh:mm A");

  // Subtract one hour from the parsed time
  const adjustedTime = localTime.subtract(1, "hours");

  // Convert to UTC time (just the time, not the date yet)
  const utcTime = adjustedTime.utc();

  // Create a new Date object from the provided startDate
  const newDate = new Date(startDate);

  // Set the hours and minutes on newDate using the converted UTC time
  newDate.setUTCHours(utcTime.hours(), utcTime.minutes(), 0, 0);

  // Return the new date with updated time
  return newDate;
};

const convertISTToUTC = (startDate, time12hr) => {
  // Parse the given date (e.g., '2024-10-20') and time (e.g., '01:00 AM') into a moment object in IST
  const istDateTime = moment.tz(
    `${startDate} ${time12hr}`,
    "YYYY-MM-DD hh:mm A",
    "Asia/Kolkata"
  );
  // Convert to UTC
  const utcDateTime = istDateTime.utc();

  // Return the UTC date and time in ISO format
  return new Date(utcDateTime);
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
  convertISTToUTC,
};
