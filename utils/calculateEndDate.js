const calculateEndDate = (startDate, plan) => {
  const date = new Date(startDate);
  switch (plan) {
    case "Monthly":
      date.setMonth(date.getMonth() + 1);
      break;
    case "3 Month":
      date.setMonth(date.getMonth() + 3);
      break;
    case "6 Month":
      date.setMonth(date.getMonth() + 6);
      break;
    case "1 Year":
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      throw new Error("Invalid plan");
  }
  return date;
};

module.exports = calculateEndDate;
