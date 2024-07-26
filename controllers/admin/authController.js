const appError = require("../../utils/appError");
const generateToken = require("../../utils/generateToken");
const bcrypt = require("bcryptjs");
const Admin = require("../../models/Admin");
const { validationResult } = require("express-validator");
const Merchant = require("../../models/Merchant");
const Manager = require("../../models/Manager");

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
    } else if (role === "Manager") {
      user = await Manager.findOne({ email: normalizedEmail });
    } else {
      formattedErrors.role = "Invalid role";
      return res.status(500).json({ errors: formattedErrors });
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

    if (user.isBlocked || user.isApproved !== "Approved") {
      formattedErrors.general = "Login is restricted";
      return res.status(403).json({ errors: formattedErrors });
    }

    let fullName;
    if (user.role === "Admin") {
      fullName = user.fullName;
    } else if (user.role === "Merchant") {
      fullName = user?.merchantDetails?.merchantName || user?.fullName || "N/A";
    } else if (user.role === "Manager") {
      fullName = user.name;
    }

    res.status(200).json({
      _id: user.id,
      fullName,
      email: user.email,
      token: generateToken(user._id, user.role),
      role: user.role,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const registerMerchantController = async (req, res, next) => {
  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const { fullName, email, phoneNumber, password } = req.body;

    const normalizedEmail = email.toLowerCase();

    const merchantExists = await Merchant.findOne({ email: normalizedEmail });

    if (merchantExists) {
      formattedErrors.email = "Email already exists";
      return res.status(409).json({ errors: formattedErrors });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newMerchant = new Merchant({
      fullName,
      email: normalizedEmail,
      phoneNumber,
      password: hashedPassword,
    });
    await newMerchant.save();

    if (newMerchant) {
      res.status(201).json({
        success: "Merchant registered successfully",
        _id: newMerchant._id,
      });
    } else {
      return next(appError("Error in registering new merchant"));
    }
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  loginController,
};
