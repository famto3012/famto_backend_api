const express = require("express");
const { body } = require("express-validator");
const isAuthenticated = require("../../../middlewares/isAuthenticated");
const isAdmin = require("../../../middlewares/isAdmin");
const { addBannerController, editBannerController } = require("../../../controllers/admin/banner/bannerController");
const { upload } = require("../../../utils/imageOperation");

const bannerRoute = express.Router();

bannerRoute.post("/add-banner", 
    upload.single("bannerImage"),
    [
        body("name").notEmpty().withMessage("Name is required"),
        body("merchantId").notEmpty().withMessage("Merchant Id is required"),
        body("geofence").notEmpty().withMessage("Geofence is required"),
    ],
    isAuthenticated,
    isAdmin,
    addBannerController
)

bannerRoute.put("/edit-banner/:id",
    upload.single("bannerImage"),
    isAuthenticated,
    isAdmin,
    editBannerController
)



module.exports = bannerRoute;
