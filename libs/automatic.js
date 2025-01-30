const { default: mongoose } = require("mongoose");
const Agent = require("../models/Agent");
const AgentAppCustomization = require("../models/AgentAppCustomization");
const Merchant = require("../models/Merchant");

const automaticStatusOfflineForAgent = async () => {
  const now = new Date();

  // Fetch all free and approved agents at once
  const agents = await Agent.find({ isApproved: "Approved", status: "Free" });

  if (!agents.length) return;

  // Extract all workTiming IDs for batch processing
  const workTimingIds = agents.flatMap(
    (agent) => agent.workStructure?.workTimings || []
  );

  if (!workTimingIds.length) return;

  // Fetch all work timings in **one query** instead of multiple
  const workTimingsData = await AgentAppCustomization.aggregate([
    { $unwind: "$workingTime" },
    {
      $match: {
        "workingTime._id": {
          $in: workTimingIds.map((id) =>
            mongoose.Types.ObjectId.createFromHexString(id)
          ),
        },
      },
    },
    {
      $project: {
        _id: "$workingTime._id",
        startTime: "$workingTime.startTime",
        endTime: "$workingTime.endTime",
      },
    },
  ]);

  // Map work timings for fast lookup
  const workTimingsMap = new Map(
    workTimingsData.map((workTime) => [workTime._id.toString(), workTime])
  );

  // Prepare bulk update operations
  const bulkOps = [];

  for (const agent of agents) {
    const workTimings = agent.workStructure.workTimings
      .map((id) => workTimingsMap.get(id.toString()))
      .filter(Boolean);

    const isWithinWorkingHours = workTimings.some(({ startTime, endTime }) => {
      const [startHour, startMinute] = startTime.split(":").map(Number);
      const [endHour, endMinute] = endTime.split(":").map(Number);

      const start = new Date(now);
      const end = new Date(now);

      start.setHours(startHour, startMinute, 0, 0);
      end.setHours(endHour, endMinute, 0, 0);

      return now >= start && now <= end;
    });

    if (!isWithinWorkingHours) {
      bulkOps.push({
        updateOne: {
          filter: { _id: agent._id },
          update: {
            $set: { status: "Inactive" },
            $push: {
              activityLog: {
                date: new Date(),
                description: "Agent automatically went OFFLINE",
              },
            },
          },
        },
      });
    }
  }

  // Execute bulk update if needed
  if (bulkOps.length) {
    await Agent.bulkWrite(bulkOps);
  }
};

const automaticStatusToggleForMerchant = async () => {
  const currentDay = new Date()
    .toLocaleString("en-us", { weekday: "long" })
    .toLowerCase();
  const currentTime = new Date().toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });

  // Fetch only relevant merchants
  const merchants = await Merchant.find({
    isApproved: "Approved",
    isBlocked: false,
    statusManualToggle: false,
  }).select("_id merchantDetail.availability.specificDays");

  let merchantsToOpen = [];
  let merchantsToClose = [];

  merchants.forEach((merchant) => {
    const todayAvailability =
      merchant?.merchantDetail?.availability?.specificDays[currentDay];

    if (todayAvailability?.specificTime) {
      let { startTime, endTime } = todayAvailability;

      // Handle past-midnight case
      if (
        (startTime <= endTime &&
          currentTime >= startTime &&
          currentTime <= endTime) ||
        (startTime > endTime &&
          (currentTime >= startTime || currentTime <= endTime))
      ) {
        merchantsToOpen.push(merchant._id);
      } else {
        merchantsToClose.push(merchant._id);
      }
    }
  });

  // Bulk update merchants who should be OPEN
  if (merchantsToOpen.length > 0) {
    await Merchant.updateMany(
      { _id: { $in: merchantsToOpen } },
      {
        $set: {
          status: true,
          openedToday: true,
          statusManualToggle: false,
        },
      }
    );
  }

  // Bulk update merchants who should be CLOSED
  if (merchantsToClose.length > 0) {
    await Merchant.updateMany(
      { _id: { $in: merchantsToClose } },
      {
        $set: {
          status: false,
          openedToday: false,
          statusManualToggle: false,
        },
      }
    );
  }

  //   console.log("Merchants opened: ", merchantsToOpen.length, merchantsToOpen);
  //   console.log("Merchants closed: ", merchantsToClose.length, merchantsToClose);
};

module.exports = {
  automaticStatusOfflineForAgent,
  automaticStatusToggleForMerchant,
};
