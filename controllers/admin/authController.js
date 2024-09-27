const appError = require("../../utils/appError");
const generateToken = require("../../utils/generateToken");
const bcrypt = require("bcryptjs");
const Admin = require("../../models/Admin");
const { validationResult } = require("express-validator");
const Merchant = require("../../models/Merchant");
const Manager = require("../../models/Manager");
const Agent = require("../../models/Agent");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

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
      fullName = user?.merchantDetails?.merchantName || user?.fullName || "-";
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

// For website
// =============================
const registerOnWebsite = async (req, res, next) => {
  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const { fullName, email, phoneNumber, role, password } = req.body;

    const normalisedEmail = email.toLowerCase();

    let userFound;
    if (role === "Merchant") {
      userFound = await Merchant.find({ email: normalisedEmail });

      if (userFound) {
        formattedErrors.email = "Email already exists";
        return res.status(409).json({ errors: formattedErrors });
      }
    } else if (role === "Agent") {
      userFound = await Agent.find({ email: normalisedEmail });

      if (userFound) {
        formattedErrors.email = "Email already exists";
        return res.status(409).json({ errors: formattedErrors });
      }

      userFound = await Agent.find({ phoneNumber });

      if (userFound) {
        formattedErrors.phoneNumber = "Phone numbers already exists";
        return res.status(409).json({ errors: formattedErrors });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let newUser;

    if (role === "Merchant") {
      newUser = await Merchant.create({
        fullName,
        email: normalisedEmail,
        phoneNumber,
        password: hashedPassword,
      });
    } else if (role === "Agent") {
      newUser = await Agent.create({
        fullName,
        email: normalisedEmail,
        phoneNumber,
      });
    }

    if (newUser) {
      return next(appError("Error in registering new User"));
    }

    res.status(200).json({ message: `New ${role} created successfully` });
  } catch (err) {
    next(appError(err.message));
  }
};

const findUserByEmail = async (email) => {
  let user = await Admin.findOne({ email });

  if (user) return { user, role: "Admin" };

  user = await Manager.findOne({ email });
  if (user) return { user, role: "Manager" };

  user = await Merchant.findOne({ email });
  if (user) return { user, role: "Merchant" };

  return null;
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Find the user in any of the models
    const userResult = await findUserByEmail(email);

    if (!userResult) {
      return res.status(404).json({ message: "User not found" });
    }

    const { user, role } = userResult;

    // Generate a token for password reset
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour expiry

    // Save the token and expiry to the user's model
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpiry = resetTokenExpiry;
    await user.save();

    // Send email with reset link
    const resetURL = `${process.env.BASE_URL}/auth/reset-password/?resetToken=${resetToken}&role=${role}`;
    const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Please make a request to:\n\n${resetURL}`;

    // Set up nodemailer transport
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    await transporter.sendMail({
      to: email,
      subject: "Password Reset",
      text: message,
    });

    res.status(200).json({ message: "Password reset link sent to email" });
  } catch (err) {
    next(appError(err.message));
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { resetToken, role } = req.query;
    const { password } = req.body;

    let user;

    if (role === "Admin") {
      user = await Admin.findOne({
        resetPasswordToken: resetToken,
        resetPasswordExpiry: { $gt: Date.now() },
      });
    } else if (role === "Manager") {
      user = await Manager.findOne({
        resetPasswordToken: resetToken,
        resetPasswordExpiry: { $gt: Date.now() },
      });
    } else if (role === "Merchant") {
      user = await Merchant.findOne({
        resetPasswordToken: resetToken,
        resetPasswordExpiry: { $gt: Date.now() },
      });
    }

    if (!user) {
      return res.status(400).json({
        message: "Token is invalid or has expired",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    // Update the password and clear the token fields
    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpiry = null;
    await user.save();

    res.status(200).json({ message: "Password has been reset" });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  loginController,
  registerOnWebsite,
  forgotPassword,
  resetPassword,
};
