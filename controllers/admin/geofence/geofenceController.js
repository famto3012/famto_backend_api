const { validationResult } = require("express-validator");

const appError = require("../../../utils/appError");

const Geofence = require("../../../models/Geofence");

const addGeofence = async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    let formattedErrors = {};
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(400).json({ errors: formattedErrors });
  }

  try {
    const { name, color, description, coordinates } = req.body;

    if (
      !Array.isArray(coordinates) ||
      !coordinates.every((coord) => Array.isArray(coord) && coord.length === 2)
    ) {
      return res.status(400).json({
        error:
          "Invalid coordinates format. Coordinates should be an array of [ latitude, longitude] pairs.",
      });
    }

    const newGeofence = new Geofence({
      name,
      color,
      description,
      coordinates,
    });

    await newGeofence.save();

    res.status(201).json({
      success: "Geofence added successfully",
      geofence: newGeofence,
    });
  } catch (err) {
    if (err.code === 11000) {
      // Handle duplicate key error
      const duplicateField = Object.keys(err.keyValue)[0];
      const message = `Duplicate value for geofence ${duplicateField}: ${err.keyValue[duplicateField]}`;
      return res.status(400).json({ error: message });
    }
    next(appError(err.message));
  }
};

const editGeofence = async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    let formattedErrors = {};
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return res.status(400).json({ errors: formattedErrors });
  }

  try {
    const { name, color, description, coordinates } = req.body;

    const updatedGeofence = await Geofence.findByIdAndUpdate(
      req.params.id,
      {
        name,
        color,
        description,
        coordinates,
      },
      { new: true }
    );

    if (!updatedGeofence) {
      return res.status(404).json({ error: "Geofence not found" });
    }

    res.status(200).json({
      success: "Geofence updated successfully",
      geofence: updatedGeofence,
    });
  } catch (err) {
    if (err.code === 11000) {
      const duplicateField = Object.keys(err.keyValue)[0];
      const message = `Duplicate value for geofence ${duplicateField}: ${err.keyValue[duplicateField]}`;
      return res.status(400).json({ error: message });
    }
    next(appError(err.message));
  }
};

const deleteGeofence = async (req, res, next) => {
  try {
    const geofence = await Geofence.findByIdAndDelete(req.params.id);

    if (!geofence) {
      return res.status(404).json({ error: "Geofence not found" });
    }

    res.status(200).json({
      success: "Geofence deleted successfully",
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getAllGeofences = async (req, res, next) => {
  try {
    const geofences = await Geofence.find();

    res.status(200).json({
      success: true,
      geofences: geofences,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const getGeofenceById = async (req, res, next) => {
  try {
    const geofence = await Geofence.findById(req.params.id);

    if (!geofence) {
      return res.status(404).json({ error: "Geofence not found" });
    }

    res.status(200).json({
      success: true,
      geofence: geofence,
    });
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  addGeofence,
  editGeofence,
  deleteGeofence,
  getAllGeofences,
  getGeofenceById,
};
