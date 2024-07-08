const bcrypt = require("bcryptjs");
const { validationResult } = require("express-validator");
const appError = require("../../../utils/appError");
const Manager = require("../../../models/Manager");
const { default: mongoose } = require("mongoose");

//Add manager
const addManagerController = async (req, res, next) => {
  const {
    name,
    email,
    phoneNumber,
    password,
    role,
    merchants,
    geofenceId,
    viewCustomers,
    domain,
  } = req.body;

  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const normalizedEmail = email.toLowerCase();

    const emailFound = await Manager.findOne({ email: normalizedEmail });

    if (emailFound) {
      formattedErrors.email = "Email already exists";
      return res.status(409).json({ errors: formattedErrors });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newManager = await Manager.create({
      name,
      email: normalizedEmail,
      phoneNumber,
      password: hashedPassword,
      role,
      merchants,
      geofenceId,
      viewCustomers,
      domain,
    });

    if (!newManager) {
      return next(appError("Error in creating new manager"));
    }

    res.status(201).json({ message: "Manager created successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

//Get manager by Id
const getManagerByIdController = async (req, res, next) => {
  try {
    const managerFound = await Manager.findById(req.params.managerId).populate(
      "geofenceId",
      "name"
    );

    if (!managerFound) {
      return next(appError("Manager not found", 404));
    }

    res.status(200).json({
      message: "Getting manager with Id",
      data: managerFound,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

//Edit manager
const editManagerController = async (req, res, next) => {
  const {
    name,
    email,
    phoneNumber,
    password,
    role,
    merchants,
    geofenceId,
    viewCustomers,
    domain,
  } = req.body;

  const errors = validationResult(req);

  let formattedErrors = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(500).json({ errors: formattedErrors });
  }

  try {
    const managerFound = await Manager.findById(req.params.managerId);

    if (!managerFound) {
      return next(appError("Manager not found", 404));
    }

    const normalizedEmail = email.toLowerCase();
    if (normalizedEmail !== managerFound.email) {
      const emailFound = await Manager.findOne({ email: normalizedEmail });

      if (emailFound) {
        formattedErrors.email = "Email already exists";
        return res.status(409).json({ errors: formattedErrors });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const updatedManager = await Manager.findByIdAndUpdate(
      req.params.managerId,
      {
        name,
        email: normalizedEmail,
        phoneNumber,
        password: hashedPassword,
        role,
        merchants,
        geofenceId,
        viewCustomers,
        domain,
      },
      { new: true }
    );

    if (!updatedManager) {
      return next(appError("Error in updating manager"));
    }

    res.status(200).json({ message: "Manager updated successfully" });
  } catch (err) {
    next(appError(err.message));
  }
};

//Get all managers
const getAllManagersController = async (req, res, next) => {
  try {
    const allManagers = await Manager.find({})
      .populate("geofenceId", "name")
      .select("-merchants -password -viewCustomers");

    res.status(200).json({
      message: "Getting all managers",
      data: allManagers,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

//Delete manager
const deleteManagerController = async (req, res, next) => {
  try {
    const managerFound = await Manager.findById(req.params.managerId);

    if (!managerFound) {
      return next(appError("Manager not found", 404));
    }

    await Manager.findByIdAndDelete(req.params.managerId);

    res.status(200).json({
      message: "Manager deleted successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

//Search manager by Name
const searchManagerByNameController = async (req, res, next) => {
  try {
    const { query } = req.query;
    const searchTerm = query.trim();

    const searchResults = await Manager.find({
      name: { $regex: searchTerm, $options: "i" },
    })
      .populate("geofenceId", "name")
      .select("-merchants -password -viewCustomers");

    res.status(200).json({
      message: "Searched manager results",
      data: searchResults,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

//Get manager by geofence
const getManagerByGeofenceController = async (req, res, next) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({
        message: "Geofence ID query parameter is required",
      });
    }

    const geofenceId = query.trim();

    // Check if the geofence ID is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(geofenceId)) {
      return res.status(400).json({
        message: "Invalid geofence ID format",
      });
    }

    const managersFound = await Manager.find({ geofenceId })
      .populate("geofenceId", "name")
      .select("-merchants -password -viewCustomers");

    res.status(200).json({
      message: "Filtered managers by geofence",
      data: managersFound,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  addManagerController,
  getManagerByIdController,
  editManagerController,
  getAllManagersController,
  deleteManagerController,
  searchManagerByNameController,
  getManagerByGeofenceController,
};
