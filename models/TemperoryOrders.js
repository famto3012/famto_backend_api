const mongoose = require("mongoose");

const tempOrderSchema = new mongoose.Schema({
  orderId: mongoose.Schema.Types.ObjectId,
  customerId: String,
  merchantId: String,
  items: Array,
  orderDetail: Object,
  billDetail: Object,
  totalAmount: Number,
  status: String,
  paymentMode: String,
  paymentStatus: String,
  paymentId: String,
  purchasedItems: Object,
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 60,
  },
});

const TemperoryOrder = mongoose.model("TemperoryOrder", tempOrderSchema);
module.exports = TemperoryOrder;
