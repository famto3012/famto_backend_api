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
      customerImageURL: {
        type: String,
        required: true,
      },
      geofence: {
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
        _id: false,
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
    customerDetails: [customerDetailSchema],
  },
  {
    timestamps: true,
  }
);

const Customer = mongoose.model("Customer", customerSchema);
module.exports = Customer;

