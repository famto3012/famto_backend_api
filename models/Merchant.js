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
      default: null,
    },
    merchantImageURL: {
      type: String,
      default: null,
    },
    displayAddress: {
      type: String,
      default: null,
    },
    description: {
      type: String,
      default: null,
    },
    geofenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Geofence",
      // default: null,
    },
    pricing: [
      {
        modelType: { type: String, required: true }, // Model name: "Product" or "Service"
        modelId: { type: mongoose.Schema.Types.ObjectId, required: true },
      },
    ],
    location: {
      type: [Number],
      default: [],
    },
    ratingByCustomers: [ratingByCustomerSchema],
    pancardNumber: {
      type: String,
      default: null,
    },
    pancardImageURL: {
      type: String,
      default: null,
    },
    GSTINNumber: {
      type: String,
      default: null,
    },
    GSTINImageURL: {
      type: String,
      default: null,
    },
    FSSAINumber: {
      type: String,
      default: null,
    },
    FSSAIImageURL: {
      type: String,
      default: null,
    },
    aadharNumber: {
      type: String,
      default: null,
    },
    aadharImageURL: {
      type: String,
      default: null,
    },
    businessCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessCategory",
      // default: null,
    },
    merchantFoodType: {
      type: String,
      enum: ["Veg", "Non-veg", "Both", " "],
      default: " ",
    },
    deliveryOption: {
      type: String,
      enum: ["On-demand", "Scheduled", "Both", " "],
      default: " ",
    },
    deliveryTime: {
      type: Number,
      // default: null,
    },
    preOrderStatus: {
      type: Boolean,
      default: false,
    },
    servingArea: {
      type: String,
      enum: ["No-restrictions", "Mention-radius", " "],
      default: " ",
    },
    servingRadius: {
      type: Number,
      default: null,
      validate: {
        validator: function (v) {
          // Allow either null or a valid number
          return v === null || typeof v === "number";
        },
        message: (props) => `${props.value} is not a valid number!`,
      },
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
      default: null,
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
    openedToday: {
      type: Boolean,
      default: false,
    },
    merchantDetail: merchantDetailSchema,
    sponsorshipDetail: {
      type: [sponsorshipSchema],
      default: [],
    },
    resetPasswordToken: {
      type: String,
    },
    resetPasswordExpiry: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
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

// day schema validation before saving the document
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
