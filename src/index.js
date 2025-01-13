import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import pkg from "body-parser";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ImageAnnotatorClient } from "@google-cloud/vision";

dotenv.config();

const app = express();
const { json } = pkg;
const port = process.env.PORT || 3002;

// CORS configuration (adjust as needed)
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(json({ limit: "50mb" })); // Increased limit for image data

// Cloud Vision API setup
const client = new ImageAnnotatorClient({
  // keyFilename: "../backend/secure/esccolon-f995f1344bc8.json", // Path to your service account key
  credentials: JSON.parse(Buffer.from(process.env.SERVICE_ACCOUNT_KEY, 'base64').toString('utf8')),
});

// Gemini API setup
const apiKey = process.env.API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-001" });

app.post("/analyzeImage", async (req, res) => {
  try {
    const imageData = req.body.imageData;
    // console.log("image data = ", imageData);

    // 1. Image Analysis (Cloud Vision API)
    const analysisResults = await analyzeImage(imageData);

    // 2. Generate Suggestions (Gemini)
    const suggestions = await generateSuggestions(analysisResults);

    res.json({ suggestions });
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({ error: "Request failed." });
  }
});

// Image analysis function (Cloud Vision)
async function analyzeImage(imageData) {
  try {
    const [result] = await client.objectLocalization({
      image: {
        content: Buffer.from(
          imageData.replace(/^data:image\/\w+;base64,/, ""),
          "base64"
        ),
      },
    });
    const objects = result.localizedObjectAnnotations.map(
      (object) => object.name
    );
    console.log("analyzed objects are = ", objects);
    return objects;
  } catch (error) {
    console.error("Cloud Vision API Error:", error);
    throw error;
  }
}

// Suggestion generation function (Gemini)
async function generateSuggestions(analysisResults) {
  const prompt = `Generate practical suggestions for reducing waste in a clean JSON format. Ensure the output uses short, actionable points that are easy to parse and display on the frontend. Structure it as follows:

  {
    "items": ["Item1", "Item2"],
    "suggestions": [
      {
        "item": "Item1",
        "actions": [
          "Action 1 for Item1",
          "Action 2 for Item1",
          "Action 3 for Item1"
        ]
      },
      {
        "item": "Item2",
        "actions": [
          "Action 1 for Item2",
          "Action 2 for Item2",
          "Action 3 for Item2"
        ]
      }
    ]
  }
  
  Avoid lengthy explanations. Provide clear and concise actions for each item. Generate the response based on these items: ${analysisResults.join(
    ", "
  )}`;

  try {
    const result = await model.generateContent([prompt]);
    const suggestions = result.response.text();
    console.log("suggestions are = ", suggestions);
    return suggestions;
  } catch (error) {
    console.error("Error generating suggestions:", error);
    throw error;
  }
}

// Default route
app.get("/", (req, res) => {
  res.send("Life on land Server running ✅");
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
