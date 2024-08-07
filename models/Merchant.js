const mongoose = require("mongoose");
const DatabaseCounter = require("./DatabaseCounter");

const daySchema = new mongoose.Schema(
  {
    openAllDay: {
      type: Boolean,
      default: false,
    },
    closedAllDay: {
      type: Boolean,
      default: false,
    },
    specificTime: {
      type: Boolean,
      default: false,
    },
    startTime: {
      type: String,
      // validate: {
      //   validator: function (v) {
      //     if (this.specificTime) {
      //       return /^([01]\d|2[0-3]):?([0-5]\d)$/.test(v);
      //     }
      //     return v === null;
      //   },
      //   message: (props) => `${props.value} is not a valid time format!`,
      // },
      default: null,
    },
    endTime: {
      type: String,
      // validate: {
      //   validator: function (v) {
      //     if (this.specificTime) {
      //       return /^([01]\d|2[0-3]):?([0-5]\d)$/.test(v);
      //     }
      //     return v === null;
      //   },
      //   message: (props) => `${props.value} is not a valid time format!`,
      // },
      default: null,
    },
  },
  {
    _id: false,
  }
);

const availabilitySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Full-time", "Specific-time"],
      required: true,
    },
    specificDays: {
      sunday: daySchema,
      monday: daySchema,
      tuesday: daySchema,
      wednesday: daySchema,
      thursday: daySchema,
      friday: daySchema,
      saturday: daySchema,
    },
  },
  {
    _id: false,
  }
);

const ratingByCustomerSchema = new mongoose.Schema(
  {
    customerId: {
      type: String,
      ref: "User",
      required: true,
    },
    review: {
      type: String,
      default: null,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
  },
  {
    _id: false,
  }
);

const sponsorshipSchema = mongoose.Schema(
  {
    sponsorshipStatus: {
      type: Boolean,
      default: false,
    },
    currentPlan: {
      type: String,
      default: null,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    paymentDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    _id: false,
  }
);

const merchantDetailSchema = new mongoose.Schema(
  {
    merchantName: {
      type: String,
      required: true,
    },
    merchantImageURL: {
      type: String,
      required: true,
    },
    displayAddress: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    geofenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Geofence",
      required: true,
    },
    pricing: [
      {
        type: mongoose.Schema.Types.Mixed,
        required: true,
        default: [],
      },
    ],
    location: {
      type: [Number],
      required: true,
    },
    ratingByCustomers: [ratingByCustomerSchema],
    pancardNumber: {
      type: String,
      required: true,
    },
    pancardImageURL: {
      type: String,
      required: true,
    },
    GSTINNumber: {
      type: String,
      required: true,
    },
    GSTINImageURL: {
      type: String,
      required: true,
    },
    FSSAINumber: {
      type: String,
      required: true,
    },
    FSSAIImageURL: {
      type: String,
      required: true,
    },
    aadharNumber: {
      type: String,
      required: true,
    },
    aadharImageURL: {
      type: String,
      required: true,
    },
    businessCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessCategory",
      required: true,
    },
    merchantFoodType: {
      type: String,
      enum: ["Veg", "Non-veg", "Both"],
    },
    deliveryOption: {
      type: String,
      enum: ["On-demand", "Scheduled", "Both"],
      required: true,
    },
    deliveryTime: {
      type: Number,
      required: true,
    },
    preOrderStatus: {
      type: Boolean,
      default: false,
    },
    servingArea: {
      type: String,
      enum: ["No-restrictions", "Mention-radius"],
      required: true,
    },
    servingRadius: {
      type: Number,
    },
    // availability: {
    //   type: availabilitySchema,
    //   required: true,
    // },
    availability: availabilitySchema,
  },
  {
    _id: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const merchantSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
    },
    fullName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      default: "Merchant",
    },
    isApproved: {
      type: String,
      enum: ["Pending", "Approved"],
      default: "Pending",
    },
    status: {
      type: Boolean,
      default: false,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    reasonForBlockingOrDeleting: {
      type: String,
      default: null,
    },
    blockedDate: {
      type: Date,
      default: null,
    },
    merchantDetail: merchantDetailSchema,
    sponsorshipDetail: {
      type: [sponsorshipSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Middleware to set the custom _id before saving
merchantSchema.pre("save", async function (next) {
  try {
    if (this.isNew) {
      const now = new Date();
      const year = now.getFullYear().toString().slice(-2); // Last two digits of the year
      const month = `0${now.getMonth() + 1}`.slice(-2); // Zero-padded month

      let counter = await DatabaseCounter.findOneAndUpdate(
        {
          type: "Merchant",
          year: parseInt(year, 10),
          month: parseInt(month, 10),
        },
        { $inc: { count: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      if (!counter) {
        throw new Error("Counter document could not be created or updated.");
      }

      const customId = `M${year}${month}${counter.count}`;
      this._id = customId;
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Virtual field for calculating the average rating
merchantDetailSchema.virtual("averageRating").get(function () {
  if (!this.ratingByCustomers || this.ratingByCustomers.length === 0) {
    return 0;
  }

  const total = this?.ratingByCustomers?.reduce(
    (acc, rating) => acc + rating.rating,
    0
  );
  return total / this?.ratingByCustomers?.length;
});

// Virtual field for checking if the merchant is serviceable today and returning "open" or "closed"
merchantDetailSchema.virtual("isServiceableToday").get(function () {
  if (this.availability?.type === "Full-time") {
    return "open";
  }

  const today = new Date()
    .toLocaleString("en-IN", { weekday: "long" })
    .toLowerCase();
  const todayAvailability = this.availability?.specificDays[today];
  if (!todayAvailability) return "closed";

  if (todayAvailability.openAllDay) return "open";
  if (todayAvailability.closedAllDay) return "closed";

  if (
    todayAvailability.specificTime &&
    todayAvailability.startTime &&
    todayAvailability.endTime
  ) {
    const now = new Date();
    const [startHour, startMinute] = todayAvailability.startTime
      .split(":")
      .map(Number);
    const [endHour, endMinute] = todayAvailability.endTime
      .split(":")
      .map(Number);

    const startTime = new Date(now.getTime());
    startTime.setHours(startHour, startMinute, 0, 0);

    const endTime = new Date(now.getTime());
    endTime.setHours(endHour, endMinute, 0, 0);

    return now >= startTime && now <= endTime ? "open" : "closed";
  }

  return "closed";
});
// });

daySchema.pre("save", function (next) {
  if (this.openAllDay) {
    this.startTime = null;
    this.endTime = null;
  } else if (this.closedAllDay) {
    this.startTime = null;
    this.endTime = null;
    this.specificTime = false;
  } else if (this.specificTime) {
    if (!this.startTime || !this.endTime) {
      return next(
        new Error(
          "Start time and end time must be provided if specificTime is true"
        )
      );
    }
  }
  next();
});

const Merchant = mongoose.model("Merchant", merchantSchema);
module.exports = Merchant;
