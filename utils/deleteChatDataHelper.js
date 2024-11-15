const Conversation = require("../models/Conversation");
const Message = require("../models/Message");

const { deleteFromFirebase } = require("./imageOperation");

const deleteExpiredConversationsAndMessages = async () => {
  const currentDate = new Date();
  // console.log(
  //   "Running chat window conversation deletion operation date: " + currentDate
  // );
  try {
    // Find and delete expired conversations
    await Conversation.find({
      deletionDate: { $lte: currentDate },
    });

    // Delete the conversations
    await Conversation.deleteMany({
      deletionDate: { $lte: currentDate },
    });

    // Find and delete expired messages
    const expiredMessages = await Message.find({
      deletionDate: { $lte: currentDate },
    });

    // Collect image URLs to delete from Firebase
    expiredMessages
      .filter((message) => message.img)
      .map((message) => {
        deleteFromFirebase(message.img);
      });

    // Delete the messages
    await Message.deleteMany({
      deletionDate: { $lte: currentDate },
    });
  } catch (err) {
    console.error("Error deleting expired conversations and messages:", err);
    throw err;
  }
};

module.exports = deleteExpiredConversationsAndMessages;
