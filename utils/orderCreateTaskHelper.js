
const appError = require("./appError")
const Task = require("../models/Task")
const AutoAllocation = require("../models/AutoAllocation")
const Order = require("../models/Order")
const Agent = require("../models/Agent")
const AgentPricing = require("../models/AgentPricing")
const Customer = require("../models/Customer")
const Merchant = require("../models/Merchant")
const { getRecipientSocketId, io } = require("../socket/socket")

const orderCreateTaskHelper = async(orderId) => {
    try{
       
      const  order = await Order.findById(orderId)
      console.log("order",order)
      const task = await Task.create({
         orderId 
       })
       
      //  res.status(201).json({
      //    message: "Task created successfully",
      //    data: task
      //  })

       const  autoAllocation = await AutoAllocation.findOne()
       console.log("Auto",autoAllocation)

       if(autoAllocation.isActive){
          if(autoAllocation.autoAllocationType === "All"){
            if(autoAllocation.priorityType === "Default"){
              await notifyAgents(order,autoAllocation.priorityType,io)
            }else{
             await notifyAgents(order,autoAllocation.priorityType,io)
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
     console.log("Agents", agents)
      const merchant = await Merchant.findById(order.merchantId)
      console.log("Mercahnt",merchant)
      const customer = await Customer.findById(order.customerId)
      console.log("Customer",customer)
      let deliveryAddress = order.orderDetail.deliveryAddress
      console.log(deliveryAddress)
      console.log("Agents array length:", agents.length); 
      console.log("Outside loop")
     for (const agent of agents) {
      console.log("Inside loop")
      console.log("AgentId",agent.id)
       const socketId = await getRecipientSocketId(agent.id);
       console.log("SocketId",socketId)
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
           orderDetails,
           
         });
 
         // Store notification in temporary storage
        //  storeNotification(agent.id, order._id, 'sent');
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
    //  console.log(monthlySalaryPricing._id)
     if (!monthlySalaryPricing) {
       throw new Error(`No pricing rule found for ruleName: "Monthly"`);
     }
 
     // Fetch all agents and filter those with the monthly salary structure ID
     const agents = await Agent.find();
     const monthlySalaryAgents = agents.filter(agent => {
      const agentSalaryStructureId = agent.workStructure.salaryStructureId.toString();
      const pricingId = monthlySalaryPricing._id.toString();
      // console.log(`Agent Salary Structure ID: ${agentSalaryStructureId}`);
      // console.log(`Monthly Salary Pricing ID for Comparison: ${pricingId}`);
      return agentSalaryStructureId === pricingId;
    });

    // console.log('Filtered Monthly Salary Agents:', monthlySalaryAgents);
   
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