const Razorpay = require("razorpay");
const crypto = require("crypto");

// Initialize Razorpay instance with your key and secret
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const createRazorpayOrder = async (amount, currency = "INR") => {
  const options = {
    amount: amount * 100, // Amount in paise
    currency,
    receipt: "receipt_" + new Date().getTime(),
  };

  try {
    const order = await razorpay.orders.create(options);

    if (!order) {
      return next(appError("Bad request", 400));
    }

    return order;
  } catch (error) {
    throw new Error("Error creating Razorpay order: " + error.message);
  }
};

const verifyRazorpayPayment = (orderId, paymentId, paymentSignature) => {
  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(orderId + "|" + paymentId)
    .digest("hex");

  return generatedSignature === paymentSignature;
};

module.exports = {
  createRazorpayOrder,
  verifyRazorpayPayment,
};
