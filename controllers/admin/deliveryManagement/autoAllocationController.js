const AutoAllocation = require("../../../models/AutoAllocation");

const appError = require("../../../utils/appError");

const addAndUpdateAutoAllocationController = async (req, res, next) => {
  try {
    const { expireTime, autoAllocationType, maxRadius, priorityType } =
      req.body;

    const adjustedMaxRadius = maxRadius !== undefined ? maxRadius : 0;

    const autoAllocation = await AutoAllocation.findOne();

    if (autoAllocation) {
      await AutoAllocation.findByIdAndUpdate(autoAllocation._id, {
        expireTime,
        autoAllocationType,
        maxRadius: adjustedMaxRadius,
        priorityType,
      });

      res.status(201).json({
        message: "Auto Allocation updated successfully",
      });
    } else {
      await AutoAllocation.create({
        expireTime,
        autoAllocationType,
        maxRadius: adjustedMaxRadius,
        priorityType,
      });

      res.status(201).json({
        message: "Auto Allocation created successfully",
      });
    }
  } catch (err) {
    next(appError(err.message));
  }
};

const getAutoAllocationController = async (req, res, next) => {
  try {
    const autoAllocation = await AutoAllocation.findOne();

    res.status(200).json({
      message: "Auto allocation found",
      data: autoAllocation || {},
    });
  } catch (err) {
    next(appError(err.message));
  }
};

const updateAutoAllocationStatus = async (req, res, next) => {
  try {
    const autoAllocation = await AutoAllocation.findOne();

    if (autoAllocation) {
      if (autoAllocation.isActive) {
        await AutoAllocation.findByIdAndUpdate(autoAllocation._id, {
          isActive: false,
        });

        res.status(201).json({
          isActive: false,
          message: "Auto Allocation is set to inactive",
        });
      } else {
        await AutoAllocation.findByIdAndUpdate(autoAllocation._id, {
          isActive: true,
        });

        res.status(201).json({
          isActive: true,
          message: "Auto Allocation is set to active",
        });
      }
    } else {
      res.status(404).json({
        message: "Please set an Auto Allocation rule",
      });
    }
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = {
  addAndUpdateAutoAllocationController,
  updateAutoAllocationStatus,
  getAutoAllocationController,
};
