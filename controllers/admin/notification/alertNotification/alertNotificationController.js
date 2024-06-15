const appError = require("../../../../utils/appError");
const { validationResult } = require("express-validator");
const { deleteFromFirebase } = require("../../../../utils/imageOperation");
const AlertNotification = require("../../../../models/AlertNotification");


  const addAlertNotificationController = async (req, res, next) => {
    try {
      const { title, description, imageUrl, merchant, agent, customer, id } = req.body;
  
      // Determine which ID field to set based on the boolean flags
      let alertNotificationData = {
        title,
        description,
        imageUrl,
        merchant,
        agent,
        customer,
      };
  
      if (merchant) {
        alertNotificationData.merchantId = id;
      } else if (agent) {
        alertNotificationData.agentId = id;
      } else if (customer) {
        alertNotificationData.customerId = id;
      } else {
        return next(appError('Invalid role specified. Please specify either merchant, agent, or customer.'));
      }
  
      // Create a new alert notification
      const newAlertNotification = new AlertNotification(alertNotificationData);
  
      // Save the alert notification to the database
      await newAlertNotification.save();
  
      res.status(201).json({ message: 'Alert notification added successfully!', alertNotification: newAlertNotification });
    } catch (err) {
      next(appError(err.message));
    }
  };


  

  

module.exports = { 
   addAlertNotificationController
   };
