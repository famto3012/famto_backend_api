const Customer = require("../models/Customer");
const Product = require("../models/Product");

const { convertToUTC } = require("./formatters");

const geoLocation = require("./getGeoLocation");

const safeParseFloat = (value, defaultValue = 0) => {
  return isNaN(parseFloat(value)) ? defaultValue : parseFloat(value);
};

// Create or return the existing customer
const findOrCreateCustomer = async ({
  customerId,
  newCustomer,
  customerAddress,
  deliveryMode,
  res,
}) => {
  if (customerId) {
    const customer = await Customer.findById(customerId);
    if (!customer) throw new Error("Customer not found");
    return customer;
  } else if (customerAddress) {
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
    const location = [customerAddress.latitude, customerAddress.longitude];
    const updatedAddress = {
      fullName: customerAddress.fullName,
      phoneNumber: customerAddress.phoneNumber,
      flat: customerAddress.flat,
      area: customerAddress.area,
      landmark: customerAddress.landmark,
      coordinates: location,
    };

    const geofence = await geoLocation(
      customerAddress.latitude,
      customerAddress.longitude
    );

    if (!geofence) {
      return res.status(400).json({
        message: "User coordinates are outside defined geofences",
      });
    }

    const updatedCustomerDetails = {
      location: location,
      geofenceId: geofence ? geofence._id : null,
      homeAddress:
        customerAddress.addressType === "home" ? updatedAddress : null,
      workAddress:
        customerAddress.addressType === "work" ? updatedAddress : null,
      otherAddress:
        customerAddress.addressType === "other" ? [updatedAddress] : [],
    };

    const updatedNewCustomer = {
      fullName: newCustomer.fullName,
      email: newCustomer.email,
      phoneNumber: newCustomer.phoneNumber,
      customerDetails: updatedCustomerDetails,
    };

    return await Customer.create(updatedNewCustomer);
  } else if (newCustomer && deliveryMode === "Take Away") {
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

    return await Customer.create({
      fullName: newCustomer.fullName,
      email: newCustomer.email,
      phoneNumber: newCustomer.phoneNumber,
    });
  }
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
  }

  return { startDate, endDate, time, numOfDays };
};

// Calculat the item total in cart
const calculateItemTotal = (items, numOfDays) => {
  let calculatedTotal;

  if (numOfDays) {
    const amount = items
      .reduce((total, item) => total + item.price * item.quantity, 0)
      .toFixed(2);

    calculatedTotal = amount * numOfDays;
  } else {
    calculatedTotal = items
      .reduce((total, item) => total + item.price * item.quantity, 0)
      .toFixed(2);
  }

  return calculatedTotal;
};

// Calculate the total weight of items
const getTotalItemWeight = (items) => {
  const weight = items.reduce(
    (total, item) => total + parseFloat(item.weight || 0),
    0
  );

  return weight.toFixed(2);
};

// Calculate additional weight charge
const calculateAdditionalWeightCharge = (
  totalWeight,
  vehicleBaseWeight,
  fareAfterBaseWeight
) => {
  if (totalWeight > vehicleBaseWeight) {
    const fare = (
      (parseFloat(totalWeight) - parseFloat(vehicleBaseWeight)) *
      parseFloat(fareAfterBaseWeight)
    ).toFixed(2);

    return parseFloat(fare);
  }

  return 0;
};

// Calcula the subTotal in cart
const calculateSubTotal = ({
  itemTotal,
  surgeCharge = 0,
  deliveryCharge,
  addedTip = 0,
  totalDiscountAmount = 0,
}) =>
  (
    parseFloat(itemTotal) +
    parseFloat(surgeCharge) +
    parseFloat(deliveryCharge) +
    parseFloat(addedTip) -
    parseFloat(totalDiscountAmount)
  ).toFixed(2);

// Calculate the grandTotal of cart
const calculateGrandTotal = ({
  itemTotal,
  surgeCharges = 0,
  deliveryCharge,
  addedTip = 0,
  taxAmount,
}) => {
  return Math.round(
    parseFloat(itemTotal) +
      parseFloat(surgeCharges) +
      parseFloat(deliveryCharge) +
      parseFloat(addedTip) +
      parseFloat(taxAmount)
  ).toFixed(2);
};

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

// Helper function to update customer address
const updateCustomerAddress = async (
  addressType,
  newAddress,
  customer,
  customerAddressOtherAddressId
) => {
  const location = [newAddress.latitude, newAddress.longitude];
  newAddress.coordinates = location;

  if (addressType === "home") {
    customer.customerDetails.homeAddress = newAddress;
  } else if (addressType === "work") {
    customer.customerDetails.workAddress = newAddress;
  } else if (addressType === "other") {
    const otherIndex = customer.customerDetails.otherAddress.findIndex(
      (addr) => addr.id.toString() === customerAddressOtherAddressId
    );

    if (otherIndex !== -1) {
      customer.customerDetails.otherAddress[otherIndex] = newAddress;
    } else {
      customer.customerDetails.otherAddress.push(newAddress);
    }
  }

  await customer.save();
  return location;
};

// Helper function to retrieve address details based on type
const getAddressDetails = (customer, addressType, addressId) => {
  if (addressType === "home") {
    return customer.customerDetails.homeAddress;
  } else if (addressType === "work") {
    return customer.customerDetails.workAddress;
  } else if (addressType === "other") {
    return customer.customerDetails.otherAddress.find(
      (addr) => addr.id.toString() === addressId
    );
  }
  return null;
};

// Main function to handle address details
const handleAddressDetails = async (
  deliveryMode,
  customer,
  customerAddressType,
  customerAddressOtherAddressId,
  newCustomer,
  newCustomerAddress,
  merchantFound,
  pickUpAddressType,
  pickUpAddressOtherAddressId,
  deliveryAddressType,
  deliveryAddressOtherAddressId,
  newPickupAddress,
  newDeliveryAddress
) => {
  console.log("deliveryMode", deliveryMode);
  console.log("customer", customer);
  console.log("customerAddressType", customerAddressType);
  console.log("customerAddressOtherAddressId", customerAddressOtherAddressId);
  console.log("newCustomer", newCustomer);
  console.log("newCustomerAddress", newCustomerAddress);
  console.log("merchantFound", merchantFound);
  console.log("pickUpAddressType", pickUpAddressType);
  console.log("pickUpAddressOtherAddressId", pickUpAddressOtherAddressId);
  console.log("deliveryAddressType", deliveryAddressType);
  console.log("deliveryAddressOtherAddressId", deliveryAddressOtherAddressId);
  console.log("newPickupAddress", newPickupAddress);
  console.log("newDeliveryAddress", newDeliveryAddress);

  let pickupLocation, pickupAddress, deliveryLocation, deliveryAddress;

  if (deliveryMode === "Take Away") {
    pickupLocation = merchantFound.merchantDetail.location;
    pickupAddress = {
      fullName: merchantFound.merchantDetail.merchantName,
      area: merchantFound.merchantDetail.displayAddress,
      phoneNumber: merchantFound.phoneNumber,
    };
    deliveryLocation = merchantFound.merchantDetail.location;
    deliveryAddress = null;
  }

  // Handling Home Delivery
  if (deliveryMode === "Home Delivery") {
    console.log(merchantFound);

    pickupLocation = merchantFound.merchantDetail.location;
    pickupAddress = {
      fullName: merchantFound.merchantDetail.merchantName,
      area: merchantFound.merchantDetail.displayAddress,
      phoneNumber: merchantFound.phoneNumber,
    };

    if (newCustomer) {
      deliveryLocation = [
        newCustomerAddress.latitude,
        newCustomerAddress.longitude,
      ];
      deliveryAddress = newCustomerAddress;
    } else {
      if (newCustomerAddress) {
        deliveryLocation = await updateCustomerAddress(
          newCustomerAddress.type,
          newCustomerAddress,
          customer,
          customerAddressOtherAddressId
        );
        deliveryAddress = newCustomerAddress;
      } else {
        const address = getAddressDetails(
          customer,
          customerAddressType,
          customerAddressOtherAddressId
        );

        if (!address) throw new Error("Address not found");
        deliveryLocation = address.coordinates;
        deliveryAddress = address;
      }
    }
  }

  // Handling Pick and Drop
  else if (deliveryMode === "Pick and Drop") {
    if (newPickupAddress) {
      pickupLocation = [newPickupAddress.latitude, newPickupAddress.longitude];
      pickupAddress = newPickupAddress;
    } else if (pickUpAddressType) {
      const address = getAddressDetails(
        customer,
        pickUpAddressType,
        pickUpAddressOtherAddressId
      );

      if (!address) throw new Error("Pickup address not found");
      pickupLocation = address.coordinates;
      pickupAddress = address;
    }

    if (newDeliveryAddress) {
      deliveryLocation = [
        newDeliveryAddress.latitude,
        newDeliveryAddress.longitude,
      ];
      deliveryAddress = newDeliveryAddress;
    } else if (deliveryAddressType) {
      const address = getAddressDetails(
        customer,
        deliveryAddressType,
        customerAddressOtherAddressId || deliveryAddressOtherAddressId
      );

      if (!address) throw new Error("Delivery address not found");
      deliveryLocation = address.coordinates;
      deliveryAddress = address;
    }
  }

  // Handling Custom Order
  else if (deliveryMode === "Custom Order") {
    if (newDeliveryAddress) {
      deliveryLocation = [
        newDeliveryAddress.latitude,
        newDeliveryAddress.longitude,
      ];
      deliveryAddress = newDeliveryAddress;

      if (newDeliveryAddress.saveAddress) {
        await updateCustomerAddress(
          deliveryAddressType,
          newDeliveryAddress,
          customer,
          deliveryAddressOtherAddressId
        );
      }
    } else if (deliveryAddressType) {
      const address = getAddressDetails(
        customer,
        deliveryAddressType,
        deliveryAddressOtherAddressId
      );

      if (!address) throw new Error("Delivery address not found");
      deliveryLocation = address.coordinates;
      deliveryAddress = address;
    }
  }

  // Check if required details are present
  if (
    (deliveryMode === "Home Delivery" || deliveryMode === "Pick and Drop") &&
    (!pickupLocation || !pickupAddress || !deliveryLocation || !deliveryAddress)
  ) {
    throw new Error("Incomplete address details");
  }

  return {
    pickupLocation,
    pickupAddress,
    deliveryLocation,
    deliveryAddress,
  };
};

module.exports = {
  safeParseFloat,
  findOrCreateCustomer,
  processSchedule,
  calculateItemTotal,
  getTotalItemWeight,
  calculateAdditionalWeightCharge,
  calculateSubTotal,
  calculateGrandTotal,
  getTotalDaysBetweenDates,
  formattedCartItems,
  handleAddressDetails,
};
