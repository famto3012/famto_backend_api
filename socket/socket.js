const { Server } = require('socket.io');
const http = require('http');
const express = require('express');

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:3000',
    }
})

const getRecipientSocketId = (recipientId) => {
	return userSocketMap[recipientId];
};



const userSocketMap = {}
io.on('connection', (socket) => {
  console.log("user connected", socket.id)  
  const userId = socket.handshake.query.userId
  if(userId != "undefined") userSocketMap[userId] = socket.id
  io.emit("getOnlineUsers", Object.keys(userSocketMap))


  socket.on('disconnect', () => {
   console.log("user disconnected", socket.id)  
   delete userSocketMap[userId] 
   io.emit("getOnlineUsers", Object.keys(userSocketMap))
  })
})

module.exports = {io, server, app, getRecipientSocketId}