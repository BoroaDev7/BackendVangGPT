const express = require("express");
const bodyParser = require("body-parser");
const { SessionsClient } = require("@google-cloud/dialogflow-cx");
const { LanguageServiceClient } = require("@google-cloud/language");

// Configura las variables de entorno
const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
const locationId = process.env.GOOGLE_CLOUD_LOCATION_ID || "global";
const agentId = process.env.GOOGLE_CLOUD_AGENT_ID;
const port = process.env.PORT || 8080;

// Instancia los clientes
const sessionClient = new SessionsClient();
const languageClient = new LanguageServiceClient();

const app = express();

app.use(bodyParser.json());

// Endpoint para el webhook de Dialogflow
app.post("/webhook", async (req, res) => {
  const { message } = req.body; // Mensaje del usuario

  try {
    // Llama a Dialogflow CX con el mensaje del usuario
    const dialogflowResponse = await detectIntentDialogflowCX(message);

    // Devuelve la respuesta del bot a la app o Postman
    res.json({
      fulfillmentText: dialogflowResponse.fulfillmentText,
      responseMessages: dialogflowResponse.responseMessages,
    });
  } catch (error) {
    console.error("Error en el webhook de Dialogflow:", error);
    res.status(500).send("Error en el servidor");
  }
});

// Función para detectar la intención en Dialogflow
async function detectIntentDialogflowCX(messageText) {
  const sessionPath = sessionClient.projectLocationAgentSessionPath(
    projectId,
    locationId,
    agentId,
    "session-id" // Puedes generar uno por cada usuario
  );

  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        text: messageText,
      },
      languageCode: "es",
    },
  };

  const [response] = await sessionClient.detectIntent(request);
  const result = response.queryResult;

  return {
    fulfillmentText: result.responseMessages[0]?.text?.text[0] || "",
  };
}

// Endpoint para resumen de sentimiento
app.post("/analyze-sentiment", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res
        .status(400)
        .json({ error: 'Se requiere un arreglo de "messages".' });
    }

    let positiveCount = 0;
    let negativeCount = 0;
    let neutralCount = 0;

    // Procesar cada mensaje
    for (const message of messages) {
      const document = {
        content: message,
        type: "PLAIN_TEXT",
      };

      const [result] = await languageClient.analyzeSentiment({ document });
      const sentiment = result.documentSentiment;
      const { score } = sentiment;

      if (score > 0.1) {
        positiveCount++;
      } else if (score < -0.1) {
        negativeCount++;
      } else {
        neutralCount++;
      }
    }

    const totalMessages = messages.length;

    const positivePercentage = ((positiveCount / totalMessages) * 100).toFixed(
      2
    );
    const negativePercentage = ((negativeCount / totalMessages) * 100).toFixed(
      2
    );
    const neutralPercentage = ((neutralCount / totalMessages) * 100).toFixed(2);

    // Enviar el resumen de los resultados
    res.json({
      positivePercentage,
      negativePercentage,
      neutralPercentage,
      totalMessages,
    });
  } catch (error) {
    console.error("Error al analizar los mensajes:", error);
    res.status(500).json({ error: "Error al analizar los mensajes." });
  }
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
