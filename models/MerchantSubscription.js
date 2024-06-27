const mongoose = require('mongoose');

const merchantSubscriptionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    duration: {
        type: Number,
        required:true
    },
    taxId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tax",
        required: true
    },
    renewalReminder: {
        type: Number,
        required:true
    },
    description: {
        type: String,
        required: true
    }   
},
  {
    timestamps: true,
  }
);

const MerchantSubscription = mongoose.model('MerchantSubscription', merchantSubscriptionSchema);
module.exports = MerchantSubscription;
