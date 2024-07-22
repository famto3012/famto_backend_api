const Customer = require("../models/Customer");
const Product = require("../models/Product");
const { convertToUTC } = require("./formatters");
const geoLocation = require("./getGeoLocation");

// Create or return the existing customer
const findOrCreateCustomer = async ({
  customerId,
  newCustomer,
  newCustomerAddress,
  formattedErrors,
}) => {
  if (customerId) {
    const customer = await Customer.findById(customerId);
    if (!customer) throw new Error("Customer not found");
    return customer;
  } else if (newCustomerAddress) {
    // Check if the customer already exists by phone number
    const existingCustomerByPhone = await Customer.findOne({
      phoneNumber: newCustomer.phoneNumber,
    });

    // Check if the customer already exists by email
    const existingCustomerByEmail = await Customer.findOne({
      email: newCustomer.email,
    });

    if (existingCustomerByPhone || existingCustomerByEmail) {
      // If customer exists, return the existing customer instead of creating a new one
      return existingCustomerByPhone || existingCustomerByEmail;
    }

    // If customer does not exist, create a new customer
    const location = [
      newCustomerAddress.latitude,
      newCustomerAddress.longitude,
    ];
    const updatedAddress = {
      fullName: newCustomerAddress.fullName,
      phoneNumber: newCustomerAddress.phoneNumber,
      flat: newCustomerAddress.flat,
      area: newCustomerAddress.area,
      landmark: newCustomerAddress.landmark,
      coordinates: location,
    };

    const geofence = await geoLocation(
      newCustomerAddress.latitude,
      newCustomerAddress.longitude
    );

    const updatedCustomerDetails = {
      location: location,
      geofenceId: geofence.id,
      homeAddress:
        newCustomerAddress.addressType === "home" ? updatedAddress : null,
      workAddress:
        newCustomerAddress.addressType === "work" ? updatedAddress : null,
      otherAddress:
        newCustomerAddress.addressType === "other" ? [updatedAddress] : [],
    };

    const updatedNewCustomer = {
      fullName: newCustomer.fullName,
      email: newCustomer.email,
      phoneNumber: newCustomer.phoneNumber,
      customerDetails: updatedCustomerDetails,
    };

    return await Customer.create(updatedNewCustomer);
  }
};

// Get the delivery address and coordinates (For merchant order creation)
const getDeliveryDetails = async ({
  customer,
  customerAddressType,
  customerAddressOtherAddressId,
  newCustomer,
  newCustomerAddress,
}) => {
  let deliveryLocation, deliveryAddress;

  if (newCustomer) {
    deliveryLocation = [
      newCustomerAddress.latitude,
      newCustomerAddress.longitude,
    ];
    deliveryAddress = newCustomerAddress;
  } else {
    const addressType = customerAddressType;

    if (newCustomerAddress) {
      const addressType = newCustomerAddress.addressType;

      deliveryLocation = [
        newCustomerAddress.latitude,
        newCustomerAddress.longitude,
      ];
      deliveryAddress = newCustomerAddress;

      if (newCustomerAddress.saveAddress) {
        // Update the existing address of the customer
        if (addressType === "home") {
          customer.customerDetails.homeAddress = {
            ...newCustomerAddress,
            coordinates: deliveryLocation,
          };
        } else if (addressType === "work") {
          customer.customerDetails.workAddress = {
            ...newCustomerAddress,
            coordinates: deliveryLocation,
          };
        } else if (addressType === "other") {
          const otherIndex = customer.customerDetails.otherAddress.findIndex(
            (addr) => addr._id.toString() === customerAddressOtherAddressId
          );

          if (otherIndex !== -1) {
            customer.customerDetails.otherAddress[otherIndex] = {
              ...newCustomerAddress,
              coordinates: deliveryLocation,
            };
          } else {
            // If not found, add the new address
            customer.customerDetails.otherAddress.push({
              ...newCustomerAddress,
              coordinates: deliveryLocation,
            });
          }
        }

        // Save the updated customer details
        await customer.save();
      }
    } else {
      if (addressType === "home") {
        deliveryLocation = customer.customerDetails.homeAddress.coordinates;
        deliveryAddress = { ...customer.customerDetails.homeAddress };
      } else if (addressType === "work") {
        deliveryLocation = customer.customerDetails.workAddress.coordinates;
        deliveryAddress = { ...customer.customerDetails.workAddress };
      } else if (addressType === "other") {
        const otherAddress = customer.customerDetails.otherAddress.find(
          (addr) => addr._id.toString() === customerAddressOtherAddressId
        );

        if (otherAddress) {
          deliveryLocation = otherAddress.coordinates;
          deliveryAddress = { ...otherAddress };
        } else {
          throw new Error("Address not found");
        }
      } else {
        throw new Error("Invalid address type");
      }
    }
  }

  return { deliveryLocation, deliveryAddress };
};

// Get the scheduled details
const processSchedule = (ifScheduled) => {
  let startDate = ifScheduled.startDate;
  let endDate = ifScheduled.endDate;
  let time = ifScheduled.time && convertToUTC(ifScheduled.time);
  let numOfDays;

  if (startDate && endDate && time) {
    startDate = new Date(startDate);
    startDate.setUTCHours(0, 0, 0, 0);

    endDate = new Date(endDate);
    endDate.setUTCHours(23, 59, 59, 999);

    numOfDays = getTotalDaysBetweenDates(startDate, endDate);
    console.log("numOfDays", numOfDays);
  }

  return { startDate, endDate, time, numOfDays };
};

// Calculat the item total in cart
const calculateItemTotal = (items) =>
  items
    .reduce((total, item) => total + item.price * item.quantity, 0)
    .toFixed(2);

// Calcula the subTotal in cart
const calculateSubTotal = ({
  itemTotal,
  deliveryCharge,
  addedTip = 0,
  totalDiscountAmount = 0,
}) =>
  (
    parseFloat(itemTotal) +
    parseFloat(deliveryCharge) +
    parseFloat(addedTip) -
    parseFloat(totalDiscountAmount)
  ).toFixed(2);

// Calculate the grandTotal of cart
const calculateGrandTotal = ({
  itemTotal,
  deliveryCharge,
  addedTip = 0,
  taxAmount,
}) =>
  (
    parseFloat(itemTotal) +
    parseFloat(deliveryCharge) +
    parseFloat(addedTip) +
    parseFloat(taxAmount)
  ).toFixed(2);

// Get the number of days betweeb scheduled dates
const getTotalDaysBetweenDates = (startDate, endDate) =>
  Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

// Function for formatting items in the response
const formattedCartItems = async (cart) => {
  const populatedCart = cart.toObject();

  // Populate the product details for each item
  const productIds = populatedCart.items.map((item) => item.productId);
  const products = await Product.find({ _id: { $in: productIds } });

  populatedCart.items = populatedCart.items.map((item) => {
    const product = products.find((p) => p._id.equals(item.productId));
    let variantTypeName = null;
    let variantTypeData = null;

    if (item.variantTypeId && product && product.variants) {
      const variantType = product.variants
        .flatMap((variant) => variant.variantTypes)
        .find((type) => type._id.equals(item.variantTypeId));

      if (variantType) {
        variantTypeName = variantType.typeName;
        variantTypeData = {
          _id: variantType._id,
          variantTypeName: variantTypeName,
        };
      }
    }

    return {
      ...item,
      productId: {
        _id: product._id,
        productName: product.productName,
        description: product.description,
        productImageURL: product.productImageURL,
      },
      variantTypeId: variantTypeData,
    };
  });

  return populatedCart;
};

const getPickAndDeliveryDetailForAdminOrderCreation = async ({
  customer,
  customerAddressType,
  customerAddressOtherAddressId,
  newCustomer,
  newCustomerAddress,
  merchantFound,
  deliveryMode,
}) => {
  let pickupLocation, pickupAddress, deliveryLocation, deliveryAddress;
  // TODO: Work out the logics of order creation by admin
  if (newCustomer) {
  }
};

module.exports = {
  findOrCreateCustomer,
  getDeliveryDetails,
  processSchedule,
  calculateItemTotal,
  calculateSubTotal,
  calculateGrandTotal,
  getTotalDaysBetweenDates,
  formattedCartItems,
  getPickAndDeliveryDetailForAdminOrderCreation,
};
