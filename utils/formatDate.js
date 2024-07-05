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

module.exports = { formatDate, formatTime };
