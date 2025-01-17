const { axios } = require("axios");

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

const handleWebhook = (req, res) => {
  //   console.log("req.body", JSON.stringify(req.body));
  const displayPhoneNumber =
    req?.body?.entry[0]?.changes[0]?.value?.metadata?.display_phone_number;
  const waId = req?.body?.entry[0]?.changes[0]?.value?.contacts[0]?.wa_id;
  const phoneNumberId =
    req.body.entry[0].changes[0].value.metadata.phone_number_id;
  const name =
    req?.body?.entry[0]?.changes[0]?.value?.contacts[0]?.profile?.name;
  const messageBody =
    req?.body?.entry[0]?.changes[0]?.value?.messages[0]?.text?.body;
  const messageType = req?.body?.entry[0]?.changes[0]?.value?.messages[0]?.type;
  const image = req?.body?.entry[0]?.changes[0]?.value?.messages[0]?.image;
  const imageCaption =
    req?.body?.entry[0]?.changes[0]?.value?.messages[0]?.image?.caption;

  console.log("displayPhoneNumber", displayPhoneNumber);
  console.log("waId", waId);
  console.log("name", name);
  console.log("messageBody", messageBody);
  console.log("messageType", messageType);
  console.log("image", image);
  console.log("imageCaption", imageCaption);

  const token =
    "EAAgZCQz0k7IUBO3OxWbZBMnCQ7iOB1k2AwET4gwKRRxFFVHl2CkFZCZC6IpZAujs9zwyhn1ZCaFPlhGhAVkvpiBNhzHnRe4ZCXTcrAdp5id7RdVTkuutQlQ1vmycBR4QEGXcmCUMS62omOiZBNOFZB4UkZArWzfUojCST2aeJGWnQgLlijxaqEeh4iJvds3BR0kzUoVAZDZD";

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

      // Safely access the first contact in the contacts array
      const contact = response?.data?.contacts && response?.data?.contacts[0];

      if (contact) {
        console.log(`Message sent to: ${contact?.input}`);
        // Perform any other operations with contact here
      } else {
        console.error("No contacts returned in the response");
      }
    })
    .catch((error) => {
      console.error(
        "Error sending message:",
        error?.response ? error?.response.data : error.message
      );
    });

  res.sendStatus(200);
};

module.exports = { verifyWebhook, handleWebhook };
