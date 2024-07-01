const MerchantSubscription = require("../../../models/MerchantSubscription");
const SubscriptionLog = require("../../../models/SubscriptionLog");
const appError = require("../../../utils/appError");
const { createRazorpayOrderId } = require("../../../utils/razorpayPayment");

const createSubscriptionLog = async (req, res, next) => {
  try {
    const { planId, userId, paymentMode } = req.body;

    const subscriptionPlan = await MerchantSubscription.findById(planId);

    if (!subscriptionPlan) {
      return res.status(404).json({ message: "Subscription plan not found" });
    }

    const { amount, duration } = subscriptionPlan;

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + duration);

    if (paymentMode === 'Online') {
        const razorpayOrderResponse = await createRazorpayOrderId(amount);
        if (!razorpayOrderResponse.success) {
          return res.status(500).json({ message: 'Failed to create Razorpay order', error: razorpayOrderResponse.error });
        }
        razorpayOrderId = razorpayOrderResponse.orderId;
        paymentStatus = 'Pending';
      }

      const subscriptionLog = new SubscriptionLog({
        planId,
        userId,
        amount,
        paymentMode,
        startDate,
        endDate,
        typeOfUser: "Merchant",
        paymentStatus,
        razorpayOrderId
      });

      await subscriptionLog.save();

      res.status(201).json({ message: 'Subscription order created successfully', subscriptionLog, razorpayOrderId });

  } catch (err) {
    next(appError(err.message));
  }
};

const verifyRazorpayPayment = async(req,res,next)=>{
    const { paymentDetails } = req.body;

    try {
      const isValidPayment = verifyPayment(paymentDetails);
      if (!isValidPayment) {
       const subscription = await SubscriptionLog.findOne({ razorpayOrderId: razorpay_order_id });
       await SubscriptionLog.findByIdAndDelete(subscription._id)
        return res.status(400).json({ message: 'Invalid payment details' });
        
      }
  
      const { razorpay_order_id, razorpay_payment_id } = paymentDetails;
      
      // Find the subscription log by Razorpay order ID
      const subscriptionLog = await SubscriptionLog.findOne({ razorpayOrderId: razorpay_order_id });
      if (!subscriptionLog) {
        return res.status(404).json({ message: 'Subscription log not found' });
      }
  
      // Update the subscription log status to 'Paid'
      subscriptionLog.paymentStatus = 'Paid';
      await subscriptionLog.save();
  
      res.status(200).json({ message: 'Payment verified and subscription log updated successfully', subscriptionLog });
    } catch (err) {
        next(appError(err.message));
    }
}


module.exports = { createSubscriptionLog, verifyRazorpayPayment }
