const { validationResult } = require("express-validator");
const Banner = require("../../../models/Banner");
const { uploadToFirebase } = require("../../../utils/imageOperation");


const addBannerController = async(req,res)=>{

    const errors = validationResult(req);
  
    if (!errors.isEmpty()) {
      let formattedErrors = {};
      errors.array().forEach((error) => {
        formattedErrors[error.param] = error.msg;
      });
      return res.status(400).json({ errors: formattedErrors });
    }

    try{
       const  { name, merchantId, geofence } = req.body

       let imageUrl = "";
      if (req.file) {
          imageUrl = await uploadToFirebase(req.file, "AdBannerImages");
        }

        const newBanner = new Banner({
            name,
            geofence,
            imageUrl,
            merchantId
          });

         const savedBanner = await newBanner.save()


         res.status(201).json({
            success: "Banner created successfully",
            data: savedBanner
          });
    }catch(err){
        next(appError(err.message));
    }
}


module.exports = { addBannerController }