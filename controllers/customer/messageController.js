const Conversation = require("../../models/Conversation");
const Message = require("../../models/Message");
const {
  getRecipientSocketId,
  io,
  sendPushNotificationToUser,
  userSocketMap,
} = require("../../socket/socket");
const { uploadToFirebase } = require("../../utils/imageOperation");

const sendMessage = async (req, res) => {
  try {
    const { recipientId, message } = req.body;
    const senderId = req.userAuth;

    let img = "";
    if (req.file) {
      const uploadedResponse = await uploadToFirebase(req.file, "chatImages");
      img = uploadedResponse;
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, recipientId] },
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [senderId, recipientId],
        lastMessage: {
          text: message,
          sender: senderId,
        },
      });
      await conversation.save();
    }

    const newMessage = new Message({
      conversationId: conversation._id,
      sender: senderId,
      text: message,
      img: img || "",
    });

    await Promise.all([
      newMessage.save(),
      conversation.updateOne({
        lastMessage: {
          text: message,
          sender: senderId,
        },
      }),
    ]);

    const formattedResponse = {
      conversationId: newMessage.conversationId,
      sender: newMessage.sender,
      seen: false, // Assuming the message is not seen when it's just sent
      img: newMessage.img,
      id: newMessage._id,
      text: newMessage.text,
      createdAt: newMessage.createdAt,
      updatedAt: newMessage.updatedAt,
    };

    const recipientSocketId = getRecipientSocketId(recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit("newMessage", formattedResponse);
      const data = {
        title: "New message",
        body: formattedResponse.text,
        image: formattedResponse.img,
      };
      const fcmToken = userSocketMap[recipientId]?.fcmToken;
      sendPushNotificationToUser(fcmToken, data);
    }

    res.status(201).json(formattedResponse);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getMessages = async (req, res) => {
  const { otherUserId } = req.params;
  const userId = req.userAuth;

  try {
    const conversation = await Conversation.findOne({
      participants: { $all: [userId, otherUserId] },
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const messages = await Message.find({
      conversationId: conversation._id,
    }).sort({ createdAt: 1 });

    const formattedMessages = messages.map((message) => ({
      id: message._id,
      conversationId: message.conversationId,
      sender: message.sender,
      seen: message.seen || false, // Assuming `seen` is false if not present
      img: message.img || "",
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      deletionDate: message.deletionDate, // Deletion date set to 7 days after creation
    }));

    res.status(200).json(formattedMessages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


const getConversations = async (req, res) => {
  const userId = req.userAuth;

  try {
    const conversations = await Conversation.find({
      participants: userId,
    }).populate({
      path: "participants",
      select: "username profilePic",
    });

    const formattedConversations = conversations.map((conversation) => {
      conversations.forEach((conversation) => {
        conversation.participants = conversation.participants.filter(
          (participant) => participant._id !== userId
        );
      });

      return {
        lastMessage: {
          seen: conversation.lastMessage?.seen || false,
          sender: conversation.lastMessage?.sender,
        },
        id: conversation._id,
        participants: conversation.participants,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        deletionDate: conversation.deletionDate, 
      };
    });

    res.status(200).json(formattedConversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


module.exports = { sendMessage, getMessages, getConversations };
