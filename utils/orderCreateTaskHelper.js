const Merchant = require("../models/Merchant")
const Order = require("../models/Order")
const appError = require("./appError")

const orderCreateTaskHelper = async(orderId) => {
    try{
       const order = await Order.findById(orderId)
       const merchant = await Merchant.findById(order.merchantId)
       const merchantName = merchant.merchantDetail.merchantName
       

    }catch(err){
       appError(err.message)
    }
}


module.exports = {orderCreateTaskHelper}