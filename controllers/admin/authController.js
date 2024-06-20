const appError = require("../../utils/appError");
const generateToken = require("../../utils/generateToken");
const bcrypt = require("bcryptjs");
const Customer = require("../../models/Customer");
const Admin = require("../../models/Admin");
const { validationResult } = require("express-validator");
const Merchant = require("../../models/Merchant");

const blockMerchant = async (req, res) => {
  try {
    const merchantId = req.params.merchantId;
    const { reasonForBlocking } = req.body;

    const merchantDetail = await Merchant.findOne({ _id: merchantId });

    if (merchantDetail.isBlocked) {
      merchantDetail.isBlocked = false;
      merchantDetail.reasonForBlockingOrDeleting = null;
      await merchantDetail.save();
      res.status(200).json({
        message: "Merchant Unblocked",
      });
    } else {
      merchantDetail.isBlocked = true;
      merchantDetail.reasonForBlockingOrDeleting = reasonForBlocking;
      await merchantDetail.save();
      res.status(200).json({
        message: "Merchant blocked",
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
    console.log("Error in blockMerchant", err.message);
  }
};

const blockCustomer = async (req, res) => {
  try {
    const customerId = req.params.customerId;
    const { reasonForBlocking } = req.body;

    const customer = await Customer.findOne({ _id: customerId });
    const customerDetail = customer.customerDetails;

    if (customerDetail.isBlocked) {
      customerDetail.isBlocked = false;
      customerDetail.reasonForBlockingOrDeleting = null;
      await customer.save();
      res.status(200).json({
        message: "Customer Unblocked",
      });
    } else {
      customerDetail.isBlocked = true;
      customerDetail.reasonForBlockingOrDeleting = reasonForBlocking;
      await customer.save();
      res.status(200).json({
        message: "Customer blocked",
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
    console.log("Error in blockMerchant", err.message);
  }
};

//For Admin and Merchant
// -----------------------------
const loginController = async (req, res, next) => {
  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const { email, password, role } = req.body;

    const normalizedEmail = email.toLowerCase();

    let user;
    if (role === "Admin") {
      user = await Admin.findOne({ email: normalizedEmail });
    } else if (role === "Merchant") {
      user = await Merchant.findOne({ email: normalizedEmail });
    } else {
      formattedErrors.role = "Invalid role";
      return res.status(500).json({ errors: formattedErrors });
    }

    if (user.isBlocked || user.isApproved !== "Approved") {
      formattedErrors.general = "Login is restricted";
      return res.status(403).json({ errors: formattedErrors });
    }
    if (!user) {
      formattedErrors.general = "Invalid credentials";
      return res.status(500).json({ errors: formattedErrors });
    }

    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password || ""
    );

    if (!isPasswordCorrect) {
      formattedErrors.general = "Invalid credentials";
      return res.status(500).json({ errors: formattedErrors });
    }

    res.status(200).json({
      _id: user.id,
      fullName: user.fullName,
      email: user.email,
      token: generateToken(user._id, user.role),
      role: user.role,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  loginController,
  blockMerchant,
  blockCustomer,
};
