const express = require("express");
// const cookieParser = require("cookie-parser");
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
const {
  orderCommissionLogHelper,
} = require("./utils/orderCommissionLogHelper");

require("dotenv").config();
require("./config/dbConnect");

const app = express();

//middlewares
app.use(express.json());
// app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: "*",
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

//agent
app.use("/api/v1/agents", agentRoute);

//customer
app.use("/api/v1/customers", customerRoute);
app.use("/api/v1/customers/subscription-payment", subscriptionLogRoute);

// Schedule the task to run daily at midnight for deleting expired plans of Merchants and customer
cron.schedule("32 15 * * *", async () => {
  // cron.schedule("23 22 * * *", async () => {
  console.log("Running scheduled task to delete expired plans");
  await deleteExpiredSponsorshipPlans();
  await deleteExpiredSubscriptionPlans();
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
