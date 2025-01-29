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
const ejs = require("ejs");
const fs = require("fs");
const path = require("path");
const verifyToken = require("../../utils/verifyToken");

//For Admin and Merchant
// =============================
const loginController = async (req, res, next) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const formattedErrors = errors.array().reduce((acc, error) => {
        acc[error.path] = error.msg;
        return acc;
      }, {});
      return res.status(500).json({ errors: formattedErrors });
    }

    const { email, password, role } = req.body;
    const normalizedEmail = email.toLowerCase();

    // Map roles to models
    const modelMap = {
      Admin,
      Merchant,
      Manager,
    };
    const UserModel = modelMap[role];
    if (!UserModel) return next(appError("Invalid role", 400));

    // Find the user based on role
    const user = await UserModel.findOne({ email: normalizedEmail }).populate(
      role === "Manager" ? "role" : ""
    );
    if (!user)
      return res.status(500).json({
        errors: { general: "Invalid credentials" },
      });

    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password || ""
    );
    if (!isPasswordCorrect)
      return res.status(500).json({
        errors: { general: "Invalid credentials" },
      });

    if (
      role !== "Manager" &&
      (user.isBlocked || user.isApproved !== "Approved")
    ) {
      return res.status(403).json({
        errors: { general: "Login is restricted" },
      });
    }

    // Generate tokens
    const fullName =
      role === "Merchant"
        ? user?.merchantDetail?.merchantName || user?.fullName || "-"
        : user.fullName || user.name;
    const token = generateToken(user._id, user.role, fullName, "2hr");

    let refreshToken = user.refreshToken;
    try {
      // Verify if the refresh token is still valid
      if (refreshToken) {
        verifyToken(refreshToken);
      } else {
        refreshToken = generateToken(user._id, user.role, fullName, "30d");
        user.refreshToken = refreshToken;
        await user.save();
      }
    } catch {
      // Generate a new refresh token if expired/invalid
      refreshToken = generateToken(user._id, user.role, fullName, "30d");
      user.refreshToken = refreshToken;
      await user.save();
    }

    res.status(200).json({
      _id: user.id,
      fullName,
      email: user.email,
      token,
      refreshToken,
      role: role === "Manager" ? user.role.roleName : user.role,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const refreshTokenController = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return next(appError("Refresh token is required", 400));
    }

    // Verify and decode the refresh token
    const decoded = verifyToken(refreshToken);
    if (!decoded) {
      return next(appError("Invalid refresh token", 401));
    }

    const { role, id } = decoded;

    // Map roles to corresponding models
    const modelMap = {
      Admin,
      Manager,
      Merchant,
      Customer,
      Agent,
    };

    const UserModel = modelMap[role];
    if (!UserModel) {
      return next(appError("Invalid role", 400));
    }

    // Check if the refresh token exists in the database
    const user = await UserModel.findOne({ refreshToken, _id: id });
    if (!user) {
      return next(appError("Invalid refresh token or user not found", 401));
    }

    // Generate a new token
    const newToken = generateToken(user._id, user.role, user.fullName, "5min");

    res.status(200).json({
      newToken,
    });
  } catch (err) {
    next(appError(err.message || "Failed to refresh token", 500));
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

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Find the user in any of the models
    const userResult = await findUserByEmail(email);

    if (!userResult) return next(appError("User not found", 404));

    const { user, role } = userResult;

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = Date.now() + 3600000;

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpiry = resetTokenExpiry;
    await user.save();

    const resetTemplatePath = path.join(
      __dirname,
      "../../templates/resetPasswordTemplate.ejs"
    );
    const resetURL = `${process.env.BASE_URL}/auth/reset-password?resetToken=${resetToken}&role=${role}`;

    const htmlContent = await ejs.renderFile(resetTemplatePath, {
      resetURL,
    });

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
      html: htmlContent,
    });

    res.status(200).json({ message: "Password reset link sent to email" });
  } catch (err) {
    next(appError(err.message));
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { password, resetToken, role } = req.body;

    // Mapping role to corresponding model
    const modelMap = {
      Admin,
      Manager,
      Merchant,
    };

    const UserModel = modelMap[role];

    if (!UserModel) return next(appError("Invalid role", 400));

    const user = await UserModel.findOne({
      resetPasswordToken: resetToken,
      resetPasswordExpiry: { $gt: Date.now() },
    });

    if (!user) return next(appError("Token is invalid or has expired", 400));

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

// Helper function
// =============================
const findUserByEmail = async (email) => {
  const models = [
    { model: Admin, role: "Admin" },
    { model: Manager, role: "Manager" },
    { model: Merchant, role: "Merchant" },
  ];

  const normalizedEmail = email.toLowerCase();

  for (let { model, role } of models) {
    const user = await model.findOne({ email: normalizedEmail });
    if (user) return { user, role };
  }

  return null;
};

module.exports = {
  loginController,
  registerOnWebsite,
  forgotPassword,
  resetPassword,
  refreshTokenController,
};
