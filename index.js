const express = require("express");
const cors = require("cors");
const cron = require("node-cron");

const globalErrorHandler = require("./middlewares/globalErrorHandler");

const categoryRoute = require("./routes/adminRoute/merchantRoute/categoryRoute/categoryRoute");
const authRoute = require("./routes/adminRoute/authRoute");
const merchantRoute = require("./routes/adminRoute/merchantRoute/merchantRoute");
const productRoute = require("./routes/adminRoute/merchantRoute/productRoute/productRoute");
const customerRoute = require("./routes/customerRoute/customerRoute");
const agentRoute = require("./routes/agentRoute/agentRoute");
const adminAgentRoute = require("./routes/adminRoute/agentRoute/agentRoute");
const geofenceRoute = require("./routes/adminRoute/geofenceRoute/geofenceRoute");
const adminNotificationRoute = require("./routes/adminRoute/notificationRoute/notificationRoute");
const bannerRoute = require("./routes/adminRoute/bannerRoute/bannerRoute");
const loyaltyPointRoute = require("./routes/adminRoute/loyaltyPointRoute/loyaltyPointRoute");
const managerRoute = require("./routes/adminRoute/managerRoute/managerRoute");
const taxRoute = require("./routes/adminRoute/taxRoute/taxRoute");
const promoCodeRoute = require("./routes/adminRoute/promoCodeRoute/promoCodeRoute");
const businessCategoryRoute = require("./routes/adminRoute/businessCategoryRoute/businessCategoryRoute");
const merchantPricingRoute = require("./routes/adminRoute/pricingRoute/merchantPricingRoute");
const merchantSurgeRoute = require("./routes/adminRoute/pricingRoute/merchantSurgeRoute");
const customerPricingRoute = require("./routes/adminRoute/pricingRoute/customerPricingRoute");
const customerSurgeRoute = require("./routes/adminRoute/pricingRoute/customerSurgeRoute");
const agentPricingRoute = require("./routes/adminRoute/pricingRoute/agentPricingRoute");
const agentSurgeRoute = require("./routes/adminRoute/pricingRoute/agentSurgeRoute");
const merchantDiscountRoute = require("./routes/adminRoute/discountRoute/merchantDiscountRoute");
const productDiscountRoute = require("./routes/adminRoute/discountRoute/productDiscountRoute");
const appBannerRoute = require("./routes/adminRoute/bannerRoute/appBannerRoute");
const appCustomizationRoute = require("./routes/adminRoute/appCustomizationRoute/appCustomizationRoute");
const { deleteExpiredSponsorshipPlans } = require("./utils/sponsorshipHelpers");
const settingsRoute = require("./routes/adminRoute/settingsRoute/settingsRoute");
const referalRoute = require("./routes/adminRoute/referalRoute/referalRoute");
const adminCustomerRoute = require("./routes/adminRoute/customerRoute/customerRoute");
const serviceCategoryRoute = require("./routes/adminRoute/serviceCategoryRoute/serviceCategoryRoute");
const pickAndDropBannerRoute = require("./routes/adminRoute/bannerRoute/pickAndDropBannerRoute");
const customOrderBannerRoute = require("./routes/adminRoute/bannerRoute/customOrderBannerRoute");
const accountLogRoute = require("./routes/adminRoute/accountLogRoute/accountLogRoute");
const commissionRoute = require("./routes/adminRoute/commissionAndSubscriptionRoute/commissionRoute");
const subscriptionRoute = require("./routes/adminRoute/commissionAndSubscriptionRoute/subscriptionRoute");
const subscriptionLogRoute = require("./routes/adminRoute/subscriptionLogRoute/subscriptionLogRoute");
const {
  deleteExpiredSubscriptionPlans,
} = require("./utils/subscriptionHelpers");
const orderRoute = require("./routes/adminRoute/orderRoute/orderRoute");
const autoAllocationRoute = require("./routes/adminRoute/deliveryManagementRoute/autoAllocationRoute");

require("dotenv").config();
require("./config/dbConnect");
const {
  createOrdersFromScheduled,
  updateOneDayLoyaltyPointEarning,
  createOrdersFromScheduledPickAndDrop,
} = require("./utils/customerAppHelpers");
const { app, server } = require("./socket/socket.js");
const ScheduledOrder = require("./models/ScheduledOrder.js");
const { orderCreateTaskHelper } = require("./utils/orderCreateTaskHelper.js");
const {
  resetAllAgentTaskHelper,
} = require("./utils/resetAllAgentTaskHelper.js");
const taskRoute = require("./routes/adminRoute/deliveryManagementRoute/taskRoute.js");
const scheduledPickAndDrop = require("./models/ScheduledPickAndDrop.js");
const {
  moveAppDetailToHistoryAndResetForAllAgents,
} = require("./utils/agentAppHelpers.js");

// const app = express();

//middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: ["http://localhost:5173", "*"],
  })
);

//routers
//admin
app.use("/api/v1/auth", authRoute); //Login is same for both Admin & Merchant
app.use("/api/v1/merchants", merchantRoute); //can be used by both admin and merchant
app.use("/api/v1/admin/agents", adminAgentRoute);
app.use("/api/v1/admin/geofence", geofenceRoute);
app.use("/api/v1/categories", categoryRoute); //can be used by both admin and merchant
app.use("/api/v1/products", productRoute); //can be used by both admin and merchant
app.use("/api/v1/admin/notification", adminNotificationRoute);
app.use("/api/v1/admin/banner", bannerRoute);
app.use("/api/v1/admin/app-banner", appBannerRoute);
app.use("/api/v1/admin/pick-and-drop-banner", pickAndDropBannerRoute);
app.use("/api/v1/admin/custom-order-banner", customOrderBannerRoute);
app.use("/api/v1/admin/loyalty-point", loyaltyPointRoute);
app.use("/api/v1/admin/promocode", promoCodeRoute);
app.use("/api/v1/merchant/shop-discount", merchantDiscountRoute);
app.use("/api/v1/admin/shop-discount", merchantDiscountRoute);
app.use("/api/v1/admin/product-discount", productDiscountRoute);
app.use("/api/v1/merchant/product-discount", productDiscountRoute);
app.use("/api/v1/admin/managers", managerRoute);
app.use("/api/v1/admin/app-customization", appCustomizationRoute);
app.use("/api/v1/admin/taxes", taxRoute);
app.use("/api/v1/admin/business-categories", businessCategoryRoute);
app.use("/api/v1/admin/service-categories", serviceCategoryRoute);
app.use("/api/v1/admin/merchant-pricing", merchantPricingRoute);
app.use("/api/v1/admin/merchant-surge", merchantSurgeRoute);
app.use("/api/v1/admin/customer-pricing", customerPricingRoute);
app.use("/api/v1/admin/customer-surge", customerSurgeRoute);
app.use("/api/v1/admin/agent-pricing", agentPricingRoute);
app.use("/api/v1/admin/agent-surge", agentSurgeRoute);
app.use("/api/v1/settings", settingsRoute);
app.use("/api/v1/referals", referalRoute);
app.use("/api/v1/admin/customers", adminCustomerRoute);
app.use("/api/v1/admin/account-log", accountLogRoute);
app.use("/api/v1/admin/commission", commissionRoute);
app.use("/api/v1/admin/subscription", subscriptionRoute);
app.use("/api/v1/admin/subscription-payment", subscriptionLogRoute);
app.use("/api/v1/merchant/subscription-payment", subscriptionLogRoute);
app.use("/api/v1/orders", orderRoute);
app.use("/api/v1/admin/auto-allocation", autoAllocationRoute);
app.use("/api/v1/admin/delivery-management", taskRoute);

//agent
app.use("/api/v1/agents", agentRoute);

//customer
app.use("/api/v1/customers", customerRoute);
app.use("/api/v1/customers/subscription-payment", subscriptionLogRoute);

// Schedule the task to run daily at midnight for deleting expired plans of Merchants and customer
cron.schedule("43 22 * * *", async () => {
  console.log("Running scheduled task to delete expired plans");
  await deleteExpiredSponsorshipPlans();
  await deleteExpiredSubscriptionPlans();
  const orderId = "6695108671cd7afba4cbfa56";
  await orderCreateTaskHelper(orderId);
});

cron.schedule("* * * * *", async () => {
  console.log("Running scheduled order job...");
  const now = new Date();
  console.log("Current Date and Time:", now);

  // Universal order
  const universalScheduledOrders = await ScheduledOrder.find({
    status: "Pending",
    $and: [
      { startDate: { $lte: now } },
      // {
      //   $or: [{ startDate: { $lte: now } }, { startDate: { $gte: now } }],
      // },
      {
        $or: [{ endDate: { $lte: now } }, { endDate: { $gte: now } }],
      },
      { time: { $lte: now } },
    ],
  });

  console.log("Found Universal scheduled Orders:", universalScheduledOrders);

  if (!universalScheduledOrders.length) {
    console.log("No scheduled orders to process at this time.");
  } else {
    for (const scheduledOrder of universalScheduledOrders) {
      console.log("Processing Scheduled Order ID:", scheduledOrder._id);
      await createOrdersFromScheduled(scheduledOrder);
    }
  }

  // Pick and Drop order
  const pickAndDropScheduledOrders = await scheduledPickAndDrop.find({
    status: "Pending",
    $and: [
      { startDate: { $lte: now } },
      {
        $or: [{ endDate: { $lte: now } }, { endDate: { $gte: now } }],
      },
      { time: { $lte: now } },
    ],
  });

  console.log(
    "Found Pick and Drop scheduled Orders:",
    pickAndDropScheduledOrders
  );

  if (!pickAndDropScheduledOrders.length) {
    console.log("No scheduled pick and drop orders to process at this time.");
  } else {
    for (const scheduledOrder of pickAndDropScheduledOrders) {
      console.log(
        "Processing Pick and Drop Scheduled Order ID:",
        scheduledOrder._id
      );
      await createOrdersFromScheduledPickAndDrop(scheduledOrder);
    }
  }
});

cron.schedule("47 13 * * *", async () => {
  await moveAppDetailToHistoryAndResetForAllAgents();
  await updateOneDayLoyaltyPointEarning();
  await resetAllAgentTaskHelper();
});

//global errors
app.use(globalErrorHandler);

//404 Error
app.use("*", (req, res) => {
  res.status(404).json({
    message: `${req.originalUrl} - Path not found`,
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
