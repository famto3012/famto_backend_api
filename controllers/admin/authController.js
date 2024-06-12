const appError = require("../../utils/appError");
const Merchant = require("../../models/MerchantDetail");
const bcrypt = require("bcryptjs");

const registerController = async (req, res, next) => {
  try {
    const { fullName, email, phoneNumber, password } = req.body;
    const merchant = await Merchant.findOne({ email });

    if (merchant) {
      return res.status(400).json({ error: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newMerchant = new Merchant({
      username: fullName,
      email,
      phoneNumber,
      password: hashedPassword,
    });
    await newMerchant.save();
  } catch (err) {
    next(appError(err.message));
  }
};

module.exports = { registerController };
