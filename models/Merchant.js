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
      type: String, // Store times as strings in "HH:MM" format
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

const merchantSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
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
    geofence: {
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
    sponsorshipStatus: {
      type: Boolean,
    },
    currentPlan: {
      type: String,
    },
    dateRange: {
      type: String,
    },
    availability: {
      type: availabilitySchema,
      required: true,
    },
    status: {
      type: String,
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    reasonForBlockingOrDeleting: {
      type: String,
    },
    role: {
      type: String,
      default: "Merchant",
    },
  },
  {
    timestamps: true,
  }
);

const Merchant = mongoose.model("Merchant", merchantSchema);
module.exports = Merchant;
