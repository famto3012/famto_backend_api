const { body } = require("express-validator");

const merchantPricingValidations = [
  body("ruleName").trim().notEmpty().withMessage("Rule name is required"),
  body("baseFare")
    .trim()
    .notEmpty()
    .withMessage("Base fare is required")
    .isNumeric()
    .withMessage("Base fare must be a number"),
  body("baseDistance")
    .trim()
    .notEmpty()
    .withMessage("Base distance is required")
    .isNumeric()
    .withMessage("Base distance must be a number"),
  body("fareAfterBaseDistance")
    .trim()
    .notEmpty()
    .withMessage("Fare after base distance is required")
    .isNumeric()
    .withMessage("Fare after base distance must be a number"),
  body("baseWeightUpTo")
    .trim()
    .notEmpty()
    .withMessage("Base weight upto is required")
    .isNumeric()
    .withMessage("Base weight upto must be a number"),
  body("fareAfterBaseWeight")
    .trim()
    .notEmpty()
    .withMessage("Fare after base weight upto is required")
    .isNumeric()
    .withMessage("Fare after base weight upto must be a number"),
  body("purchaseFarePerHour")
    .trim()
    .notEmpty()
    .withMessage("Purchase fare per hour is required")
    .isNumeric()
    .withMessage("Purchase fare per hour must be a number"),
  body("waitingFare")
    .trim()
    .notEmpty()
    .withMessage("Waiting fare is required")
    .isNumeric()
    .withMessage("Waiting fare must be a number"),
  body("waitingTime")
    .trim()
    .notEmpty()
    .withMessage("Waiting time is required")
    .isNumeric()
    .withMessage("Waiting time must be a number"),
  body("geofenceId").trim().notEmpty().withMessage("Geofence is required"),
];

const surgeValidations = [
  body("ruleName").trim().notEmpty().withMessage("Rule name is required"),
  body("baseFare")
    .trim()
    .notEmpty()
    .withMessage("Base fare is required")
    .isNumeric()
    .withMessage("Base fare must be a number"),
  body("baseDistance")
    .trim()
    .notEmpty()
    .withMessage("Base distance is required")
    .isNumeric()
    .withMessage("Base distance must be a number"),
  body("waitingFare")
    .trim()
    .notEmpty()
    .withMessage("Waiting fare is required")
    .isNumeric()
    .withMessage("Waiting fare must be a number"),
  body("waitingTime")
    .trim()
    .notEmpty()
    .withMessage("Waiting time is required")
    .isNumeric()
    .withMessage("Waiting time must be a number"),
  body("geofenceId").trim().notEmpty().withMessage("Geofence is required"),
];

const customerPricingValidations = [
  body("deliveryMode").trim().notEmpty().withMessage("Order type is required"),
  body("ruleName").trim().notEmpty().withMessage("Rule name is required"),
  body("baseFare")
    .trim()
    .notEmpty()
    .withMessage("Base fare is required")
    .isNumeric()
    .withMessage("Base fare must be a number"),
  body("baseDistance")
    .trim()
    .notEmpty()
    .withMessage("Base distance is required")
    .isNumeric()
    .withMessage("Base distance must be a number"),
  body("fareAfterBaseDistance")
    .trim()
    .notEmpty()
    .withMessage("Fare after base distance is required")
    .isNumeric()
    .withMessage("Fare after base distance must be a number"),
  body("baseWeightUpto")
    .trim()
    .notEmpty()
    .withMessage("Base weight upto is required")
    .isNumeric()
    .withMessage("Base weight upto must be a number"),
  body("fareAfterBaseWeight")
    .trim()
    .notEmpty()
    .withMessage("Fare after base weight upto is required")
    .isNumeric()
    .withMessage("Fare after base weight upto must be a number"),
  body("purchaseFarePerHour")
    .trim()
    .notEmpty()
    .withMessage("Purchase fare per hour is required")
    .isNumeric()
    .withMessage("Purchase fare per hour must be a number"),
  body("waitingFare")
    .trim()
    .notEmpty()
    .withMessage("Waiting fare is required")
    .isNumeric()
    .withMessage("Waiting fare must be a number"),
  body("waitingTime")
    .trim()
    .notEmpty()
    .withMessage("Waiting time is required")
    .isNumeric()
    .withMessage("Waiting time must be a number"),
  body("geofenceId").trim().notEmpty().withMessage("Geofence is required"),
];

const agentPricingValidations = [
  body("ruleName").trim().notEmpty().withMessage("Rule name is required"),
  body("baseFare")
    .trim()
    .notEmpty()
    .withMessage("Base fare is required")
    .isNumeric()
    .withMessage("Base fare must be a number"),
  body("baseDistanceFare")
    .optional()
    .trim()
    .isNumeric()
    .withMessage("Base distance fare must be a number"),
  body("extraFarePerDay")
    .optional()
    .trim()
    .isNumeric()
    .withMessage("Extra fare per day must be a number"),
  body("baseDistanceFarePerKM")
    .optional()
    .trim()
    .isNumeric()
    .withMessage("Base distance fare per KM must be a number"),
  body("purchaseFarePerHour")
    .trim()
    .notEmpty()
    .withMessage("Purchase fare per hour is required")
    .isNumeric()
    .withMessage("Purchase fare per hour must be a number"),
  body("waitingFare")
    .trim()
    .notEmpty()
    .withMessage("Waiting fare is required")
    .isNumeric()
    .withMessage("Waiting fare must be a number"),
  body("waitingTime")
    .trim()
    .notEmpty()
    .withMessage("Waiting time is required")
    .isNumeric()
    .withMessage("Waiting time must be a number"),
  body("geofenceId").trim().notEmpty().withMessage("Geofence is required"),
];

module.exports = {
  merchantPricingValidations,
  surgeValidations,
  customerPricingValidations,
  agentPricingValidations,
};
