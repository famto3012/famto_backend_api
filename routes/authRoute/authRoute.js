const express = require("express")
const { registerController, loginController } = require("../../controllers/admin/authController")


const router = express.Router()

router.post("/register", registerController)
router.post("/signin", loginController)


module.exports = router