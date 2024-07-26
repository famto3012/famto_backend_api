const bcrypt = require("bcryptjs");
const { validationResult } = require("express-validator");

const Admin = require("../../../models/Admin");
const Merchant = require("../../../models/Merchant");

const getUserProfileController = async (req, res, next) => {
  try {
    const currentUserId = req.userAuth;

    // Find the user in Admin collection
    const adminFound = await Admin.findById(currentUserId).select(
      "fullName email phoneNumber"
    );

    if (adminFound) {
      return res.status(200).json({
        message: "Setting data",
        data: adminFound,
      });
    }

    // Find the user in Merchant collection if not found in Admin
    const merchantFound = await Merchant.findById(currentUserId).select(
      "fullName email phoneNumber"
    );

    if (merchantFound) {
      return res.status(200).json({
        message: "Setting data",
        data: merchantFound,
      });
    }

    // If user is not found in both collections
    return next(appError("User not found", 404));
  } catch (err) {
    return next(appError(err.message));
  }
};

const updateUserProfileController = async (req, res, next) => {
  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const currentUserId = req.userAuth;
    const { fullName, email, phoneNumber } = req.body;

    // Normalize email to lowercase
    const normalizedEmail = email ? email.toLowerCase() : undefined;

    // Check if the email is already used by another user
    const adminExists = await Admin.findOne({
      email: normalizedEmail,
      _id: { $ne: currentUserId },
    });
    const merchantExists = await Merchant.findOne({
      email: normalizedEmail,
      _id: { $ne: currentUserId },
    });

    if (normalizedEmail && (adminExists || merchantExists)) {
      formattedErrors.email = "Email already exists";
      return res.status(409).json({ errors: formattedErrors });
    }

    let userFound;

    // Prepare the update data
    let updateData = { fullName, email: normalizedEmail, phoneNumber };

    // Attempt to update Admin profile
    userFound = await Admin.findByIdAndUpdate(currentUserId, updateData, {
      new: true,
      runValidators: true,
    }).select("fullName email phoneNumber");

    if (userFound) {
      return res.status(200).json({
        message: "User details updated successfully",
        data: userFound,
      });
    }

    // Attempt to update Merchant profile if not found in Admin
    userFound = await Merchant.findByIdAndUpdate(currentUserId, updateData, {
      new: true,
      runValidators: true,
    }).select("fullName email phoneNumber");

    if (userFound) {
      return res.status(200).json({
        message: "User details updated successfully",
        data: userFound,
      });
    }

    // If user is not found in both collections
    return next(appError("User not found", 404));
  } catch (err) {
    return next(appError(err.message));
  }
};

const changeUserPasswordController = async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().reduce((acc, error) => {
      acc[error.path] = error.msg;
      return acc;
    }, {});
    return res.status(400).json({ errors: formattedErrors });
  }

  try {
    const currentUser = req.userAuth;

    // Function to change password
    const changePassword = async (user, newPassword) => {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      user.password = hashedPassword;
      await user.save();
    };

    // Check if user is admin
    let user = await Admin.findById(currentUser);
    if (!user) {
      // If not admin, check if user is merchant
      user = await Merchant.findById(currentUser);
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isPasswordMatch = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isPasswordMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    await changePassword(user, newPassword);

    res.status(200).json({
      message: `${user.constructor.modelName} password changed successfully`,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  getUserProfileController,
  updateUserProfileController,
  changeUserPasswordController,
};
