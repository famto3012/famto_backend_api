const axios = require("axios");
const WhatsApp = require("../../models/Whatsapp");
const { uploadToFirebase } = require("../../utils/imageOperation");

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

// const handleWebhook = (req, res) => {
//   console.log("req.body", JSON.stringify(req.body));

//   const messageEvent = req?.body?.entry?.[0]?.changes?.[0]?.value;
//   if (!messageEvent?.messages) {
//     console.log("No messages found in webhook, ignoring event.");
//     return res.sendStatus(200); // Exit early
//   }

//   const displayPhoneNumber =
//     req?.body?.entry?.[0]?.changes?.[0]?.value?.metadata?.display_phone_number;
//   const waId = req?.body?.entry?.[0]?.changes?.[0]?.value?.contacts?.[0]?.wa_id;
//   const phoneNumberId =
//     req.body.entry?.[0].changes?.[0].value.metadata.phone_number_id;
//   const name =
//     req?.body?.entry?.[0]?.changes?.[0]?.value?.contacts?.[0]?.profile?.name;
//   const messageBody =
//     req?.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body;
//   const messageType =
//     req?.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.type;
//   const location =
//     req?.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.location;
//   const image =
//     req?.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.image;
//   const imageCaption =
//     req?.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.image?.caption;
//   const message = messageEvent?.messages?.[0];

//   if (message?.type === "audio") {
//     const audioData = {
//       mimeType: message.audio.mime_type,
//       sha256: message.audio.sha256,
//       audioId: message.audio.id,
//       voice: message.audio.voice,
//     };

//     console.log("Audio Data:", audioData);
//   }

//   if (message?.type === "contacts") {
//     const contact = message?.contacts?.[0];

//     const contactData = {
//       firstName: contact?.name?.first_name,
//       middleName: contact?.name?.middle_name,
//       lastName: contact?.name?.last_name,
//       fullName: contact?.name?.formatted_name,
//       company: contact?.org?.company,
//       phone: contact?.phones?.[0]?.phone,
//       waId: contact?.phones?.[0]?.wa_id,
//       phoneType: contact?.phones?.[0]?.type,
//     };

//     console.log("Contact Data:", contactData);
//   }

//   if (message?.type === "document") {
//     const documentData = {
//       fileName: message?.document?.filename,
//       mimeType: message?.document?.mime_type,
//       sha256: message?.document?.sha256,
//       documentId: message?.document?.id,
//     };

//     console.log("Document Data:", documentData);
//   }

//   console.log("displayPhoneNumber", displayPhoneNumber);
//   console.log("waId", waId);
//   console.log("name", name);
//   console.log("messageBody", messageBody);
//   console.log("messageType", messageType);
//   console.log("image", image);
//   console.log("imageCaption", imageCaption);
//   console.log("location", location);

//   const token =
//     "EAAgZCQz0k7IUBO3OxWbZBMnCQ7iOB1k2AwET4gwKRRxFFVHl2CkFZCZC6IpZAujs9zwyhn1ZCaFPlhGhAVkvpiBNhzHnRe4ZCXTcrAdp5id7RdVTkuutQlQ1vmycBR4QEGXcmCUMS62omOiZBNOFZB4UkZArWzfUojCST2aeJGWnQgLlijxaqEeh4iJvds3BR0kzUoVAZDZD";

//   const payload = {
//     messaging_product: "whatsapp",
//     recipient_type: "individual",
//     to: waId,
//     type: "text",
//     text: {
//       preview_url: false,
//       body: `Hello ${name}, Your message received`,
//     },
//   };

//   const headers = {
//     "Content-Type": "application/json",
//     Authorization: `Bearer ${token}`,
//   };

//   axios
//     .post(
//       `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
//       payload,
//       { headers }
//     )
//     .then((response) => {
//       console.log("Message sent successfully:", response?.data);

//       // Safely access the first contact in the contacts array
//       const contact = response?.data?.contacts && response?.data?.contacts[0];

//       if (contact) {
//         console.log(`Message sent to: ${contact?.input}`);
//         // Perform any other operations with contact here
//       } else {
//         console.error("No contacts returned in the response");
//       }
//     })
//     .catch((error) => {
//       console.error(
//         "Error sending message:",
//         error?.response ? error?.response.data : error.message
//       );
//     });

//   res.sendStatus(200);
// };

const handleWebhook = async (req, res) => {
  console.log("req.body", JSON.stringify(req.body));

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
          id: message.image.id,
          mimeType: message.image.mime_type,
          sha256: message.image.sha256,
          caption: message.image.caption,
        }
      : undefined,

    audio: message?.audio
      ? {
          id: message.audio.id,
          mimeType: message.audio.mime_type,
          sha256: message.audio.sha256,
          voice: message.audio.voice,
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
          fileName: message.document.filename,
          mimeType: message.document.mime_type,
          sha256: message.document.sha256,
          documentId: message.document.id,
        }
      : undefined,
    received: true,
  };

  // Save to MongoDB
  try {
    const savedMessage = await WhatsApp.create(messageData);
    console.log("Message stored in DB:", savedMessage);
  } catch (error) {
    console.error("Error saving message to DB:", error);
  }

  // Sending response back to WhatsApp
  const token = process.env.WHATSAPP_API_TOKEN;

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: waId,
    type: "text",
    text: {
      preview_url: false,
      body: `Hello ${name}, Your message received`,
    },
  };

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  axios
    .post(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      payload,
      { headers }
    )
    .then((response) => {
      console.log("Message sent successfully:", response?.data);
    })
    .catch((error) => {
      console.error(
        "Error sending message:",
        error?.response ? error?.response.data : error.message
      );
    });

  res.sendStatus(200);
};

// const sendWhatsAppMessage = async (req, res) => {
//   try {
//     const { to, messageType, content, name, displayPhoneNumber } = req.body;

//     if (!to || !messageType || !content) {
//       return res.status(400).json({ error: "Missing required fields" });
//     }

//     const token = process.env.WHATSAPP_API_TOKEN; // Store token in environment variables
//     const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

//     const headers = {
//       "Content-Type": "application/json",
//       Authorization: `Bearer ${token}`,
//     };

//     let payload = {
//       messaging_product: "whatsapp",
//       recipient_type: "individual",
//       to,
//     };

//     // Prepare message data to be saved in the WhatsApp model
//     const messageData = {
//       displayPhoneNumber,
//       waId: to,
//       phoneNumberId,
//       name,
//       messageBody: content,
//       messageType,
//       send: true, // Mark as sent initially
//       timestamp: Date.now(),
//     };

//     // Handling different message types
//     switch (messageType) {
//       case "text":
//         payload.type = "text";
//         payload.text = { preview_url: false, body: content };
//         messageData.messageBody = content; // Store the text message
//         break;

//       case "image":
//         payload.type = "image";
//         payload.image = { link: content }; // content should be an image URL
//         messageData.image = { link: content }; // Store the image data
//         break;

//       case "document":
//         payload.type = "document";
//         payload.document = { link: content }; // content should be a document URL
//         messageData.document = { link: content }; // Store the document data
//         break;

//       default:
//         return res.status(400).json({ error: "Invalid message type" });
//     }

//     // Save the message data to the database
//     const savedMessage = await WhatsApp.create(messageData);
//     console.log("Message saved to database:", savedMessage);

//     // Sending request to WhatsApp API
//     const response = await axios.post(
//       `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
//       payload,
//       { headers }
//     );

//     // Log the response from WhatsApp API
//     console.log("Message sent successfully:", response.data);

//     // Optionally update the message data in the database with the WhatsApp response (e.g., messageId, status)
//     const updatedMessage = await WhatsApp.findByIdAndUpdate(
//       savedMessage._id,
//       {
//         messageId: response.data.messages[0].id,
//         deliveryStatus: "sent", // You can later update the status to delivered or read based on events
//       },
//       { new: true }
//     );

//     // Return the success response with saved and updated message data
//     res.status(200).json({
//       success: true,
//       data: updatedMessage,
//       message: "Message sent and saved successfully",
//     });
//   } catch (error) {
//     console.error(
//       "Error sending message:",
//       error?.response ? error.response.data : error.message
//     );
//     res.status(500).json({ error: "Failed to send message" });
//   }
// };

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
        // Check if an image file was uploaded
        // console.log("req", req);
        if (req.files && req.files.image && req.files.image[0]) {
          const mimeType = req.files?.image[0]?.mimetype; // Get the mime type of the uploaded image

          if (mimeType !== "image/jpeg" && mimeType !== "image/png") {
            return res.status(400).json({
              error: "Invalid image format. Only JPEG and PNG are supported.",
            });
          }
          console.log("Here");
          const imageUrl = await uploadToFirebase(
            req.files.image[0],
            "Whatsapp Images"
          );
          console.log("ImageUrl", imageUrl);
          // messageData.messageBody = imageUrl; // Assuming you're using a service like AWS S3 for file storage
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
          const documentUrl = await uploadToFirebase(
            req.files.document[0],
            "Whatsapp Documents"
          ); // Assuming you're using a service like AWS S3 for file storage
          payload.type = "document";
          payload.document = { link: documentUrl }; // Document URL should be used for WhatsApp API
          messageData.document = { link: documentUrl }; // Store the document data in the database
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

module.exports = { verifyWebhook, handleWebhook, sendWhatsAppMessage };
