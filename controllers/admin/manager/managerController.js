const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { validationResult } = require("express-validator");

const appError = require("../../../utils/appError");

const Manager = require("../../../models/Manager");
const ManagerRoles = require("../../../models/ManagerRoles");

//Add manager
const addManagerController = async (req, res, next) => {
  const { name, email, phoneNumber, password, role, geofenceId } = req.body;

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
      geofenceId,
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
    const managerFound = await Manager.findById(req.params.managerId).select(
      "-password"
    );

    if (!managerFound) {
      return next(appError("Manager not found", 404));
    }

    res.status(200).json(managerFound);
  } catch (err) {
    next(appError(err.message));
  }
};

//Edit manager
const editManagerController = async (req, res, next) => {
  const { name, email, phoneNumber, password, role, geofenceId } = req.body;

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
        geofenceId,
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
const fetchAllManagersController = async (req, res, next) => {
  try {
    const { geofence, name } = req.query;

    const matchCriteria = {};

    if (geofence) {
      matchCriteria.geofence = mongoose.Types.ObjectId.createFromHexString(
        geofence?.trim()
      );
    }

    if (name) {
      matchCriteria.name = { $regex: name?.trim(), $options: "i" };
    }

    const allManagers = await Manager.find(matchCriteria)
      .populate("geofenceId", "name")
      .populate("role", "roleName")
      .select("-password -resetPasswordToken -resetPasswordExpiry");

    const formattedResponse = allManagers?.map((manager) => ({
      managerId: manager?._id,
      name: manager?.name,
      email: manager?.email,
      role: manager?.role?.roleName,
      phone: manager?.phoneNumber,
      geofence: manager?.geofenceId?.name,
    }));

    res.status(200).json(formattedResponse);
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

const createManagerRoleController = async (req, res, next) => {
  try {
    const { roleName, allowedRoutes } = req.body;

    const newRole = new ManagerRoles({
      roleName,
      allowedRoutes,
    });

    await newRole.save();

    res.status(201).json({
      success: true,
      message: "Manager role created successfully",
      data: newRole,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getManagerRolesController = async (req, res, next) => {
  try {
    const roles = await ManagerRoles.find({});

    const formattedRoles = roles?.map((role) => ({
      roleId: role._id,
      roleName: role.roleName,
      allowedRoutes: role.allowedRoutes?.map((route) => ({
        label: route.label,
        route: route.route,
      })),
    }));

    res.status(200).json(formattedRoles);
  } catch (err) {
    next(appError(err.message));
  }
};

const getSingleManagerRole = async (req, res, next) => {
  try {
    const { roleId } = req.params;

    const role = await ManagerRoles.findById(roleId);

    if (!role) return next(appError("Role not found", 404));

    const formattedResponse = {
      roleName: role.roleName,
      allowedRoutes: role.allowedRoutes?.map((route) => ({
        label: route.label,
        route: route.route,
      })),
    };

    res.status(200).json(formattedResponse);
  } catch (err) {
    next(appError(err.message));
  }
};

const editManagerRoleController = async (req, res) => {
  try {
    const { roleId } = req.params;
    const { roleName, allowedRoutes } = req.body;

    const role = await ManagerRoles.findById(roleId);

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Manager role not found",
      });
    }

    role.roleName = roleName || role.roleName;
    role.allowedRoutes = allowedRoutes || role.allowedRoutes;

    await role.save();

    res.status(200).json({
      message: "Manager role updated successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const deleteManagerRoleController = async (req, res, next) => {
  try {
    const { roleId } = req.params;

    const role = await ManagerRoles.findByIdAndDelete(roleId);

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Manager role not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Manager role deleted successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  addManagerController,
  getManagerByIdController,
  editManagerController,
  fetchAllManagersController,
  deleteManagerController,

  createManagerRoleController,
  getManagerRolesController,
  getSingleManagerRole,
  editManagerRoleController,
  deleteManagerRoleController,
};
