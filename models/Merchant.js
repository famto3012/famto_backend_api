const mongoose = require("mongoose");

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
      validate: {
        validator: function (v) {
          return /^([01]\d|2[0-3]):?([0-5]\d)$/.test(v);
        },
        message: (props) => `${props.value} is not a valid time format!`,
      },
    },
    endTime: {
      type: String,
      validate: {
        validator: function (v) {
          return /^([01]\d|2[0-3]):?([0-5]\d)$/.test(v);
        },
        message: (props) => `${props.value} is not a valid time format!`,
      },
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
      enum: ["full-time", "specific-time"],
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
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    ratingDescription: {
      type: String,
      required: true,
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
    plan: {
      type: String,
      default: null,
    },
    startDate: {
      type: String,
      default: null,
    },
    endDate: {
      type: String,
      default: null,
    },
    paymentDetails: {
      type: String,
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
      type: mongoose.Schema.ObjectId,
      ref: "Geofence",
      required: true,
    },
    ratings: [ratingByCustomerSchema],
    location: {
      type: String,
      required: true,
    },
    pricing: {
      type: String,
      required: true,
    },
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
    bussinessCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BussinessCategory",
    },
    ifRestaurant: {
      type: String,
    },
    deliveryOption: {
      type: String,
      required: true,
    },
    deliveryTime: {
      type: String,
      required: true,
    },
    servingArea: {
      type: String,
      required: true,
    },
    servingRadius: {
      type: String,
    },
    availability: {
      type: availabilitySchema,
      required: true,
    },
  },
  {
    _id: false,
  }
);

const merchantSchema = new mongoose.Schema(
  {
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
      enum: ["Pending", "Approved", "Rejected"],
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
    merchantDetail: merchantDetailSchema,
    sponsorship: sponsorshipSchema,
  },
  {
    timestamps: true,
  }
);

// Virtual field for calculating the average rating
merchantDetailSchema.virtual("averageRating").get(function () {
  if (this.ratings?.length === 0) return 0;
  const total = this.ratings?.reduce((acc, rating) => acc + rating.rating, 0);
  return total / this.ratings?.length;
});

// Virtual field for checking if the merchant is serviceable today and returning "open" or "closed"
merchantDetailSchema.virtual("isServiceableToday").get(function () {
  const today = new Date()
    .toLocaleString("en-US", { weekday: "long" })
    .toLowerCase();
  const todayAvailability = this.availability?.specificDays[today];
  if (!todayAvailability) return "closed";

  if (todayAvailability.openAllDay) return "open";
  if (todayAvailability.closedAllDay) return "closed";

  if (
    todayAvailability?.specificTime &&
    todayAvailability?.startTime &&
    todayAvailability?.endTime
  ) {
    const now = new Date();
    const [startHour, startMinute] = todayAvailability.startTime
      .split(":")
      .map(Number);
    const [endHour, endMinute] = todayAvailability.endTime
      .split(":")
      .map(Number);

    const startTime = new Date(now.setHours(startHour, startMinute, 0));
    const endTime = new Date(now.setHours(endHour, endMinute, 0));

    return now >= startTime && now <= endTime ? "open" : "closed";
  }

  return "closed";
});

const Merchant = mongoose.model("Merchant", merchantSchema);
module.exports = Merchant;
