// const appError = require("../../utils/appError");
// const generateToken = require("../../utils/generateToken")
// const bcrypt = require("bcryptjs");
// const os = require("os")
// const Customer = require("../../models/Customer");
// const { validationResult } = require("express-validator");

// const registerAndLoginController = async (req, res, next) => {
//     const errors = validationResult(req);
  
//     let formattedErrors = {};
//     if (!errors.isEmpty()) {
//       errors.array().forEach((error) => {
//         formattedErrors[error.path] = error.msg;
//       });
//       return res.status(500).json({ errors: formattedErrors });
//     }
    
//     try {
//       const { email, phoneNumber, latitude, longitude } = req.body;
//       const location = [ latitude, longitude];
      
//       let customer = {};
//       let newCustomer = {};
  
//       if (email) {
//         customer = await Customer.findOne({ email });
//       } else {
//         customer = await Customer.findOne({ phoneNumber });
//       }
  
//       if (customer) {
//         if (customer.customerDetails.isBlocked) {
//           return res.status(400).json({
//             message: "Account is Blocked"
//           });
//         } else {
//           customer.lastPlatformUsed = os.platform();
//           await customer.save();
  
//           return res.status(200).json({
//             success: "User logged in successfully",
//             id: customer.id,
//             token: generateToken(customer.id, customer.role),
//             role: customer.role
//           });
//         }
//       } else {
//         if (email) {
//           newCustomer = new Customer({
//             email,
//             customerDetails: {
//               location,
//               geofence: geoLocation(latitude, longitude)
//             },
//           });
//         } else {
//           newCustomer = new Customer({
//             phoneNumber,
//             customerDetails: {
//               location,
//               geofence: geoLocation(latitude, longitude)
//             },
//           });
//         }
  
//         await newCustomer.save();
  
//         return res.status(201).json({
//           success: "User created successfully",
//           id: newCustomer.id,
//           token: generateToken(newCustomer.id)
//         });
//       }
//     } catch (err) {
//       next(appError(err.message));
//     }
//   };

//   const geoLocation = async (latitude, longitude) => {
//     try {
  
//       // Convert latitude and longitude to [longitude, latitude] format
//       const location = [ latitude, longitude];
  
//       // Find the geofence that contains this location
//       const geofence = await Geofence.findOne({
//         coordinates: {
//           $geoIntersects: {
//             $geometry: {
//               type: "Point",
//               coordinates: location
//             }
//           }
//         }
//       });
  
//       if (!geofence) {
//         return res.status(404).json({ error: "No geofence found for this location" });
//       }
  
//     return geofence.id;
//     } catch (err) {
//       next(appError(err.message));
//     }
//   };



// module.exports = { registerAndLoginController, };

const appError = require("../../utils/appError");
const generateToken = require("../../utils/generateToken");
const bcrypt = require("bcryptjs");
const os = require("os");
const Customer = require("../../models/Customer");
const Geofence = require("../../models/Geofence"); // Assuming you have a Geofence model
const { validationResult } = require("express-validator");

const registerAndLoginController = async (req, res, next) => {
  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const { email, phoneNumber, latitude, longitude } = req.body;
    const location = [latitude, longitude];

    let customer = {};
    let newCustomer = {};

    if (email) {
      customer = await Customer.findOne({ email });
    } else {
      customer = await Customer.findOne({ phoneNumber });
    }

    if (customer) {
      if (customer.customerDetails.isBlocked) {
        return res.status(400).json({
          message: "Account is Blocked"
        });
      } else {
        customer.lastPlatformUsed = os.platform();
        await customer.save();

        return res.status(200).json({
          success: "User logged in successfully",
          id: customer.id,
          token: generateToken(customer.id, customer.role),
          role: customer.role
        });
      }
    } else {
      const geofenceId = await geoLocation(latitude, longitude, next);

      if (email) {
        newCustomer = new Customer({
          email,
          customerDetails: {
            location,
            geofence: geofenceId
          }
        });
      } else {
        newCustomer = new Customer({
          phoneNumber,
          customerDetails: {
            location,
            geofence: geofenceId
          }
        });
      }

      await newCustomer.save();

      return res.status(201).json({
        success: "User created successfully",
        id: newCustomer.id,
        token: generateToken(newCustomer.id)
      });
    }
  } catch (err) {
    next(appError(err.message));
  }
};

const geoLocation = async (latitude, longitude, next) => {
  try {
    const location = [longitude, latitude]; // Ensure the order is [longitude, latitude]

    const geofence = await Geofence.findOne({
      coordinates: {
        $geoIntersects: {
          $geometry: {
            type: "Point",
            coordinates: location
          }
        }
      }
    });

    if (!geofence) {
      throw new Error("No geofence found for this location");
    }

    return geofence._id;
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = { registerAndLoginController };
