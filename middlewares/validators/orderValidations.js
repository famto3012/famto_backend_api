const { body } = require("express-validator");

const adminInvoiceValidations = [
  body("deliveryOption")
    .trim()
    .notEmpty()
    .withMessage("Please select a delivery option"),
  body("deliveryMode")
    .trim()
    .notEmpty()
    .withMessage("Please select a delivery mode"),
  body("items")
    .isArray({ min: 1 })
    .withMessage("Please select at least one item"),
  body("customerAddressType").custom((value, { req }) => {
    const { deliveryMode, customerAddressType } = req.body;

    if (deliveryMode === "Home Delivery" && !customerAddressType) {
      throw new Error("Please select a delivery address type");
    }

    return true;
  }),
  body("merchantId").custom((value, { req }) => {
    const { deliveryMode, merchantId } = req.body;

    if (
      (deliveryMode === "Take Away" || deliveryMode === "Home Delivery") &&
      !merchantId
    ) {
      throw new Error("Please select a merchant");
    }

    return true;
  }),
  body("customerId").custom((value, { req }) => {
    const { customerId, newCustomer, deliveryMode } = req.body;

    if (!customerId && !newCustomer) {
      throw new Error("Please select a customer");
    }

    if (newCustomer && typeof newCustomer !== "object") {
      throw new Error("Please provide all details of the new customer");
    }

    if (
      newCustomer &&
      deliveryMode === "Home Delivery" &&
      !newCustomer.newCustomerAddress
    ) {
      throw new Error("Please provide an address for the new customer");
    }

    if (
      newCustomer &&
      ["Pick and Drop", "Custom Order"].includes(deliveryMode) &&
      !newCustomer.newPickupAddress
    ) {
      throw new Error("Please provide an address for pickup");
    }

    if (
      newCustomer &&
      ["Pick and Drop", "Custom Order"].includes(deliveryMode) &&
      !newCustomer.newDeliveryAddress
    ) {
      throw new Error("Please provide an address for delivery");
    }

    return true;
  }),
  body("customerAddressOtherAddressId").custom((value, { req }) => {
    const { customerAddressType, customerAddressOtherAddressId } = req.body;

    if (customerAddressType === "other" && !customerAddressOtherAddressId) {
      throw new Error("Please select an address");
    }

    return true;
  }),
  body("vehicleType").custom((value, { req }) => {
    const { deliveryMode, vehicleType } = req.body;

    if (deliveryMode === "Pick and Drop" && !vehicleType) {
      throw new Error("Please select a vehicle type");
    }

    return true;
  }),
];

module.exports = { adminInvoiceValidations };
