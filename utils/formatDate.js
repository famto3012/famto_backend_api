const formatDate = (date) => {
  const options = {
    day: "2-digit",
    month: "short",
    year: "numeric",
  };

  const formatedDate = new Date(date).toLocaleDateString("en-GB", options);

  return formatedDate;
};

module.exports = formatDate;
