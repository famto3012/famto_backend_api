const Razorpay = require("razorpay");
const crypto = require("crypto");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const createRazorpayOrderId = async (amount) => {
  try {
    console.log("amount", amount);

    const options = {
      amount: Math.round(amount * 100), // amount in paise
      currency: "INR",
      receipt: crypto.randomBytes(10).toString("hex"),
    };

    const order = await razorpay.orders.create(options);

    console.log(order);

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
  console.log(paymentDetails);
  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", razorpay.key_secret)
    .update(body.toString())
    .digest("hex");

  return expectedSignature === razorpay_signature;
};

const razorpayRefund = async (paymentId, amount) => {
  try {
    const refundOptions = {
      payment_id: paymentId,
      amount: amount * 100,
    };

    const refund = await razorpay.payments.refund(refundOptions);

    return { success: true, refundId: refund.id };
  } catch (err) {
    console.error("Error in processing refund:", err);
    return { success: false, error: err.message };
  }
};

module.exports = { createRazorpayOrderId, verifyPayment, razorpayRefund };
