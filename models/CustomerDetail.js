const mongoose = require("mongoose");


const ratingByAgentSchema = new mongoose.Schema(
  {
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
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

const customerDetailSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.ObjectId,
      ref: "Customer",
    },
    customerImageURL: {
      type: String,
      required: true,
    },
    geofenceId: {
      type: mongoose.Schema.ObjectId,
      ref: "Geofence",
      required: true,
    },
    ratings: [ratingByAgentSchema],
    status: {
      type: String,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    reasonForBlockingOrDeleting: {
      type: String,
    },
    homeAddress: {
      type: String,
      default: null,
    },
    workAddress: {
      type: String,
      default: null,
    },
    otherAddress: {
      type: String,
      default: null,
    },
  
  },
  {
    timestamps: true,
  }
);

const CustomerDetail = mongoose.model("CustomerDetail", customerDetailSchema);
module.exports = CustomerDetail;
