
const appError = require("./appError")
const Task = require("../models/Task")
const AutoAllocation = require("../models/AutoAllocation")
const Order = require("../models/Order")
const Agent = require("../models/Agent")
const AgentPricing = require("../models/AgentPricing")
const Customer = require("../models/Customer")
const Merchant = require("../models/Merchant")

const orderCreateTaskHelper = async(orderId) => {
    try{
       
      const  order = await Order.findById(orderId)
      const task = await Task.create({
         orderId 
       })
       
       res.status(201).json({
         message: "Task created successfully",
         data: task
       })

       const  autoAllocation = await AutoAllocation.findOne()

       if(autoAllocation.isActive){
          if(autoAllocation.autoAllocationType === "All"){
            if(autoAllocation.priorityType === "Default"){
                
            }else{

            }
            }else{

            }
          }else{

          }
       

    }catch(err){
       appError(err.message)
    }
}

const notifyAgents = async (order, priorityType, io) => {
   try {
      let agents 
      if(priorityType === "Default"){
          agents = await fetchAgents();
      }else{
         agents = await fetchMonthlySalaryAgents()
      }
      const merchant = await Merchant.findById(order.merchantId)
      const customer = await Customer.findById(order.customerId)
      let deliveryAddress
      if (order.orderDetail.deliveryAddressType === "home") {
         deliveryAddress = customer.customerDetails.homeAddress;
       } else if (order.orderDetail.deliveryAddressType === "work") {
         deliveryAddress = customer.customerDetails.workAddress;
       } else {
         deliveryAddress = customer.customerDetails.otherAddress.find(
           (addr) => addr._id.toString() === order.orderDetail.deliveryAddressType
         );
       }

     for (const agent of agents) {
       const socketId = getAgentSocketId(agent.id);
       if (socketId) {
         // Emit notification to agent
         const orderDetails = {
            orderId: order.id,
            merchantName: merchant.merchantDetail.merchantName,
            pickAddress: merchant.merchantDetail.displayAddress,
            customerName: customer.fullName,
            customerAddress: deliveryAddress
         }
         
         io.to(socketId).emit('newOrder', {
           title: 'New Order',
           body: `You have a new order: ${orderDetails}`,
           
         });
 
         // Store notification in temporary storage
         storeNotification(agent.id, order._id, 'sent');
       }
     }
   } catch (err) {
     appError(err.message);
   }
 };

 const storeNotification = (agentId, orderId, status) => {
   notificationLogs.set(agentId, { orderId, status });
 };
 
 const fetchMonthlySalaryAgents = async () => {
   try {
     // Find the AgentPricing document where ruleName is "Monthly"
     const monthlySalaryPricing = await AgentPricing.findOne({ ruleName: "Monthly-salaried" });
 
     if (!monthlySalaryPricing) {
       throw new Error(`No pricing rule found for ruleName: "Monthly"`);
     }
 
     // Fetch all agents and filter those with the monthly salary structure ID
     const agents = await Agent.find();
     const monthlySalaryAgents = agents.filter(agent =>
       agent.workStructureDetails.salaryStructureId.toString() === monthlySalaryPricing._id.toString()
     );
 
     return monthlySalaryAgents;
   } catch (error) {
     console.error("Error fetching monthly salary agents:", error.message);
     throw error;
   }
 };

 const fetchAgents = async()=>{
     const agents = await Agent.find()
    return agents
 }

module.exports = {orderCreateTaskHelper}