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
    console.log(options)
    const order = await razorpay.orders.create(options);
    console.log("order", order)
    return { success: true, orderId: order.id };
  } catch (err) {
    console.error("Error in processing payment:", err);
    return { success: false, error: err.message };
  }
};

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

const razorpayRefund = async (paymentId, amount) => {
  try {
    const refund = await razorpay.payments.refund(paymentId, {
      amount: amount * 100,
      speed: "normal",
    });

    return { success: true, refundId: refund.id };
  } catch (err) {
    console.error("Error in processing refund:", err);
    return { success: false, error: err.message };
  }
};

const createRazorpayQrCode = async (amount) => {
  try {
    const qrCode = await razorpay.qrCode.create({
      type: "upi_qr",
      usage: "single_use",
      fixed_amount: true,
      payment_amount: amount * 100,
      description: "Amount to be paid",
      name: "FAMTO Delivery",
    });

    return qrCode;
  } catch (err) {
    console.error(
      "Error creating Razorpay QR code:",
      JSON.stringify(err, null, 2)
    );

    throw new Error(err.message || "Failed to create Razorpay QR code");
  }
};

const createSettlement = async () => {
  try {
    console.log("Running Razorpay settlement...");

    const settlement = await razorpay.settlements.createOndemandSettlement({
      settle_full_balance: true,
      description: "Settling full payments",
    });

    console.log("Settlement created:", settlement);

    console.log("Finished running Razorpay settlement.");

    return settlement; // Optional: return the settlement if needed
  } catch (err) {
    console.error(
      "Error creating Razorpay settlement:",
      JSON.stringify(err, null, 2)
    );
  }
};

module.exports = {
  createRazorpayOrderId,
  verifyPayment,
  razorpayRefund,
  createRazorpayQrCode,
  createSettlement,
};
