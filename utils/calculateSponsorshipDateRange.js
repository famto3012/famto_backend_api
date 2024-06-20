const addMonths = (date, months) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

const calculateDateRange = (subscriptionPlan) => {
  const startDate = new Date();
  let endDate;

  switch (subscriptionPlan) {
    case "1-month":
      endDate = addMonths(startDate, 1);
      break;
    case "3-months":
      endDate = addMonths(startDate, 3);
      break;
    case "6-months":
      endDate = addMonths(startDate, 6);
      break;
    case "1-year":
      endDate = addMonths(startDate, 12);
      break;
    default:
      throw new Error("Invalid subscription plan");
  }

  return { startDate, endDate };
};

module.exports = calculateDateRange;
