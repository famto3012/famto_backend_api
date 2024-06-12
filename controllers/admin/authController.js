const appError = require("../../utils/appError");
const Merchant = require("../../models/Admin");
const generateToken = require("../../utils/generateToken")
const bcrypt = require("bcryptjs");
const MerchantDetail = require("../../models/MerchantDetail");

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
      fullName,
      email,
      phoneNumber,
      password: hashedPassword,
    });
    await newMerchant.save();

    if (newMerchant) {
      res.status(201).json({
        success: "User created successfully",
        _id: newMerchant._id,
        fullName: newMerchant.fullName,
        email: newMerchant.email,
        phoneNumber: newMerchant.phoneNumber,
      });
    } else {
      res.status(400).json({ error: "Invalid user data received" });
    }
  } catch (err) {
    next(appError(err.message));
  }
};

const loginController = async (req, res) => {
  try {
    const { email, password } = req.body;

    const merchant = await Merchant.findOne({ email });
    const merchantDetails = await MerchantDetail.findOne({merchantId: merchant.id})
    const isPasswordCorrect = await bcrypt.compare(
      password,
      merchant?.password || ""
    );

    if (!merchant || !isPasswordCorrect) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    if(merchant.isApproved){
      
     if(merchantDetails.isBlocked){
      res.status(400).json({
       message: "Account is Blocked"
      });
     }else{
      res.status(200).json({
        _id: merchant.id,
        fullName: merchant.fullName,
        email: merchant.email,
        token:  generateToken(merchant._id, merchant.role),
        role: merchant.role
      });
     }
   
    }else{
      res.status(400).json({
       message: "Registration not approved"
      });
    }

   
  } catch (err) {
    res.status(500).json({ error: err.message });
    console.log("Error in loginUser", err.message);
  }
};

const blockMerchant= async (req, res)=>{

  try{

  }catch(err){
    
  }
}



module.exports = { registerController, loginController };
