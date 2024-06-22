const Razorpay = require("razorpay");
const crypto = require("crypto");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const createRazorpayOrderId = async (amount) => {
  try {
    const options = {
      amount: amount * 100,
      currency: "INR",
      receipt: crypto.randomBytes(10).toString("hex"),
    };
    const order = await razorpay.orders.create(options);
    return { success: true, orderId: order.id };
  } catch (err) {
    console.error("Error in processing payment:", err);
    return { success: false, error: err.message };
  }
};

// Function to verify payment
const verifyPayment = async (paymentDetails) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    paymentDetails;
  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", razorpay.key_secret)
    .update(body.toString())
    .digest("hex");

  return expectedSignature === razorpay_signature;
};

module.exports = { createRazorpayOrderId, verifyPayment };
