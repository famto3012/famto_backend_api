const mongoose = require('mongoose');

const commissionSchema = new mongoose.Schema(
  {
    commissionType: {
      type: String,
      enum:["Fixed","Percentage"],
      required: true,
    },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
    },
    commissionValue: {
      type: Number,
      required: true,
    },
},
  {
    timestamps: true,
  }
);

const Commission = mongoose.model('Commission', commissionSchema);
module.exports = Commission;
