const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    flat: {
      type: String,
      required: true,
    },
    area: {
      type: String,
      required: true,
    },
    landmark: {
      type: String,
      default: null,
    },
  },
  {
    _id: false,
  }
);

const ratingByAgentSchema = new mongoose.Schema(
  {
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      required: true,
    },
    review: {
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

const customerDetailSchema = new mongoose.Schema(
  {
    customerImageURL: {
      type: String,
    },
    location: {
      type: [[Number]],
    },
    geofenceId: {
      type: mongoose.Schema.ObjectId,
      ref: "Geofence",
    },
    walletBalance: {
      type: Number,
      default: 0,
    },
    ratingsByAgents: [ratingByAgentSchema],
    isBlocked: {
      type: Boolean,
      default: false,
    },
    reasonForBlockingOrDeleting: {
      type: String,
    },
    blockedDate: {
      type: Date,
    },
    homeAddress: {
      type: addressSchema,
      default: null,
    },
    workAddress: {
      type: addressSchema,
      default: null,
    },
    otherAddress: [
      {
        fullName: String,
        phoneNumber: String,
        flat: String,
        area: String,
        landmark: String,
      },
    ],
  },
  {
    _id: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const customerSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
    },
    email: {
      type: String,
    },
    phoneNumber: {
      type: String,
    },
    lastPlatformUsed: {
      type: String,
      //required:true
    },
    role: {
      type: String,
      default: "Customer",
    },
    customerDetails: customerDetailSchema,
  },
  {
    timestamps: true,
  }
);

// Virtual field for calculating the average rating
customerDetailSchema.virtual("averageRating").get(function () {
  if (this.ratingsByAgents.length === 0) return 0;
  const total = this.ratingsByAgents.reduce(
    (acc, rating) => acc + rating.rating,
    0
  );
  return total / this.ratingsByAgents.length;
});

const Customer = mongoose.model("Customer", customerSchema);
module.exports = Customer;
