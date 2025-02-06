const axios = require("axios");
const WhatsApp = require("../../models/Whatsapp");
const {
  uploadFileToFirebaseForWhatsapp,
} = require("../../utils/imageOperation");
const { timeAgo } = require("../../utils/formatters");
const Admin = require("../../models/Admin");
const Manager = require("../../models/Manager");
const { sendSocketData, sendNotification } = require("../../socket/socket");

const verifyWebhook = (req, res) => {
  if (
    req.query["hub.mode"] == "subscribe" &&
    req.query["hub.verify_token"] == "token"
  ) {
    res.send(req.query["hub.challenge"]);
  } else {
    res.sendStatus(400);
  }
};

const handleWebhook = async (req, res) => {
  // console.log("req.body", JSON.stringify(req.body));

  const messageEvent = req?.body?.entry?.[0]?.changes?.[0]?.value;
  if (!messageEvent?.messages) {
    console.log("No messages found in webhook, ignoring event.");
    return res.sendStatus(200);
  }

  const displayPhoneNumber = messageEvent?.metadata?.display_phone_number;
  const phoneNumberId = messageEvent?.metadata?.phone_number_id;
  const waId = messageEvent?.contacts?.[0]?.wa_id;
  const name = messageEvent?.contacts?.[0]?.profile?.name;
  const message = messageEvent?.messages?.[0];

  const messageData = {
    displayPhoneNumber,
    phoneNumberId,
    waId,
    name,
    messageBody: message?.text?.body,
    messageType: message?.type,
    timestamp: message?.timestamp,
    messageId: message?.id,

    location: message?.location
      ? {
          latitude: message.location.latitude,
          longitude: message.location.longitude,
        }
      : undefined,

    image: message?.image
      ? {
          // id: message.image.id,
          // mimeType: message.image.mime_type,
          // sha256: message.image.sha256,
          caption: message.image.caption,
          link: await getAndDownloadMedia(message.image.id, phoneNumberId),
        }
      : undefined,

    audio: message?.audio
      ? {
          // id: message.audio.id,
          mimeType: message.audio.mime_type,
          // sha256: message.audio.sha256,
          // voice: message.audio.voice,
          link: await getAndDownloadMedia(
            message.audio.id,
            phoneNumberId,
            message.audio.mime_type
          ),
        }
      : undefined,

    contact:
      message?.type === "contacts" && message?.contacts?.[0]
        ? {
            firstName: message.contacts[0].name.first_name,
            middleName: message.contacts[0].name.middle_name,
            lastName: message.contacts[0].name.last_name,
            fullName: message.contacts[0].name.formatted_name,
            company: message.contacts[0].org?.company,
            phone: message.contacts[0].phones?.[0]?.phone,
            waId: message.contacts[0].phones?.[0]?.wa_id,
            phoneType: message.contacts[0].phones?.[0]?.type,
          }
        : undefined,

    document: message?.document
      ? {
          // fileName: message.document.filename,
          mimeType: message.document.mime_type,
          // sha256: message.document.sha256,
          // documentId: message.document.id,
          link: await getAndDownloadMedia(
            message.document.id,
            phoneNumberId,
            message.document.mime_type
          ),
        }
      : undefined,
    received: true,
  };

  let savedMessage;
  try {
    savedMessage = await WhatsApp.create(messageData);
    // console.log("Message stored in DB:", savedMessage);
  } catch (error) {
    console.error("Error saving message to DB:", error);
  }

  const updatedMessageData = {
    ...messageData, // Spread the existing object
    timestamp: "now", // Update the timestamp field
  };

  const admins = await Admin.find({}, "_id"); // Get only _id fields
  const managers = await Manager.find({}, "_id"); // Get only _id fields
  const eventName = "newMessage"; // Define your custom event name here

  // Extract the IDs into a single array
  const userIds = [
    ...admins.map((admin) => admin._id),
    ...managers.map((manager) => manager._id),
  ];

  const formattedWaId = (waId) => {
    const waIdStr = waId.toString();
    return `+${waIdStr.slice(0, 2)} ${waIdStr.slice(2)}`;
  };

  const data = {
    fcm: {
      title: "New Whatsapp Message",
      body: `${messageData.name || formattedWaId(messageData.waId)}: ${
        messageData.messageBody
      }`,
    },
  };

  userIds.forEach((userId) => {
    sendSocketData(userId, eventName, updatedMessageData);
    sendNotification(userId, eventName, data);
  });
  // Call the function with all IDs

  // Save to MongoDB

  res.sendStatus(200);
};

const getAndDownloadMedia = async (mediaId, phoneNumberId, mimeType) => {
  try {
    const token = process.env.WHATSAPP_API_TOKEN;

    // Step 1: Get media URL
    const mediaResponse = await axios.get(
      `https://graph.facebook.com/v21.0/${mediaId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { phone_number_id: phoneNumberId },
      }
    );

    if (!mediaResponse.data.url) throw new Error("Media URL not found");

    const mediaUrl = mediaResponse.data.url;

    // Step 2: Download media file
    const fileResponse = await axios.get(mediaUrl, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: "arraybuffer", // To handle binary data
    });
    console.log("fileResponse", fileResponse.data);
    const firebaseUrl = await uploadFileToFirebaseForWhatsapp(
      fileResponse.data,
      "whatsapp_media",
      mimeType
    );

    return firebaseUrl; // Return the permanent Firebase URL
  } catch (error) {
    console.error(
      "Error fetching or saving media:",
      error.response?.data || error.message
    );
    return null;
  }
};

const sendWhatsAppMessage = async (req, res) => {
  try {
    const { to, messageType, content, name, displayPhoneNumber } = req.body;

    // Check if required fields are present in the body
    if (!to || !messageType) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const token = process.env.WHATSAPP_API_TOKEN; // Store token in environment variables
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    // Initialize the payload for WhatsApp API
    let payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
    };

    // Prepare the message data for saving to the database
    const messageData = {
      displayPhoneNumber,
      waId: to,
      phoneNumberId,
      name,
      messageBody: content,
      messageType,
      send: true, // Mark as sent initially
      timestamp: Date.now(),
    };

    // Handle the different message types
    switch (messageType) {
      case "text":
        payload.type = "text";
        payload.text = { preview_url: false, body: content };
        messageData.messageBody = content; // Store the text message
        break;

      case "image":
        if (req.files && req.files.image && req.files.image[0]) {
          const mimeType = req.files?.image[0]?.mimetype; // Get the mime type of the uploaded image

          if (mimeType !== "image/jpeg" && mimeType !== "image/png") {
            return res.status(400).json({
              error: "Invalid image format. Only JPEG and PNG are supported.",
            });
          }

          const imageUrl = await uploadFileToFirebaseForWhatsapp(
            req.files.image[0].buffer,
            "Whatsapp Images",
            mimeType
          );

          payload.type = "image";
          payload.image = { link: imageUrl }; // Image URL should be used for WhatsApp API
          messageData.image = { link: imageUrl }; // Store the image data in the database
        } else {
          return res.status(400).json({ error: "No image file uploaded" });
        }
        break;

      case "document":
        // Check if a document file was uploaded
        if (req.files && req.files.document && req.files.document[0]) {
          console.log("req.files", req.files.document[0]);
          const documentUrl = await uploadFileToFirebaseForWhatsapp(
            req.files.document[0].buffer,
            "Whatsapp Documents",
            req.files.document[0].mimetype
          ); // Assuming you're using a service like AWS S3 for file storage
          payload.type = "document";
          payload.document = { link: documentUrl }; // Document URL should be used for WhatsApp API
          messageData.document = {
            link: documentUrl,
            mimeType: req.files.document[0].mimetype,
          }; // Store the document data in the database
        } else {
          return res.status(400).json({ error: "No document file uploaded" });
        }
        break;

      default:
        return res.status(400).json({ error: "Invalid message type" });
    }

    // Save the message data to the database
    const savedMessage = await WhatsApp.create(messageData);
    console.log("Message saved to database:", savedMessage);

    // Send the message to WhatsApp API
    const response = await axios.post(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      payload,
      { headers }
    );

    // Log the response from WhatsApp API
    console.log("Message sent successfully:", response.data);

    // Optionally update the message data in the database with the WhatsApp response (e.g., messageId, status)
    const updatedMessage = await WhatsApp.findByIdAndUpdate(
      savedMessage._id,
      {
        messageId: response.data.messages[0].id,
        deliveryStatus: "sent", // You can later update the status to delivered or read based on events
      },
      { new: true }
    );

    // Return the success response with saved and updated message data
    res.status(200).json({
      success: true,
      data: updatedMessage,
      message: "Message sent and saved successfully",
    });
  } catch (error) {
    console.error(
      "Error sending message:",
      error?.response ? error.response.data : error.message
    );
    res.status(500).json({ error: "Failed to send message" });
  }
};

const getWhatsAppMessages = async (req, res) => {
  try {
    const messages = await WhatsApp.aggregate([
      {
        $sort: { timestamp: -1 }, // Sort messages by latest timestamp first
      },
      {
        $group: {
          _id: "$waId", // Group by unique waId
          latestMessage: { $first: "$$ROOT" }, // Get the latest message for each user
          receivedMessages: { $push: "$$ROOT" }, // Collect all messages for each user
        },
      },
      {
        $project: {
          _id: 0,
          waId: "$latestMessage.waId",
          name: {
            $cond: {
              if: { $gt: [{ $size: "$receivedMessages" }, 0] }, // Check if there are any received messages
              then: {
                $let: {
                  vars: {
                    receivedMessage: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: "$receivedMessages",
                            as: "message",
                            cond: { $eq: ["$$message.received", true] },
                          },
                        },
                        0,
                      ],
                    },
                  },
                  in: "$$receivedMessage.name", // Use name from the first received message
                },
              },
              else: { $concat: ["+", "$latestMessage.waId"] }, // Prepend '+' if no received message
            },
          },
          lastMessage: "$latestMessage.messageBody",
          timestamp: "$latestMessage.timestamp",
        },
      },
      {
        $sort: { timestamp: -1 }, // Sort final result by latest message time
      },
    ]);

    const formattedMessages = messages.map((msg) => ({
      waId: msg.waId,
      name: msg.name,
      lastMessage: msg.lastMessage,
      timeAgo: timeAgo(msg.timestamp),
    }));

    res.status(200).json({ success: true, data: formattedMessages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getMessagesByWaId = async (req, res) => {
  const { waId } = req.params; // Extract waId from request params

  try {
    // Fetch all messages by waId, sorted by timestamp in ascending order (oldest first)
    const messages = await WhatsApp.find({ waId })
      .sort({ createdAt: 1 }) // Sort by timestamp in ascending order
      .exec();

    // Check if messages are found
    if (!messages || messages.length === 0) {
      return res
        .status(404)
        .json({ message: "No messages found for this waId." });
    }

    const formattedMessages = messages.map((msg) => ({
      ...msg.toObject(), // Convert Mongoose document to plain object
      timestamp: timeAgo(new Date(msg.createdAt).getTime()),
    }));

    // Send the sorted messages as response
    return res.status(200).json({
      message: "Messages fetched successfully",
      data: formattedMessages, // The sorted messages
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return res.status(500).json({
      message: "An error occurred while fetching messages",
      error: error.message,
    });
  }
};

module.exports = {
  verifyWebhook,
  handleWebhook,
  sendWhatsAppMessage,
  getWhatsAppMessages,
  getMessagesByWaId,
};
