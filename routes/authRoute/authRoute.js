const express = require("express")
const { registerController, loginController, blockMerchant } = require("../../controllers/admin/authController")
const  isAuthenticated = require("../../middlewares/isAuthenticated")
const  isAdmin = require("../../middlewares/isAdmin")


const router = express.Router()

router.post("/register", registerController)
router.post("/signin", loginController)
router.put("/block/:merchantId", isAuthenticated, isAdmin, blockMerchant)


module.exports = router