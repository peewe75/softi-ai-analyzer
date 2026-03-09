import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const geminiApiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
    throw new Error("Missing Gemini API key. Set VITE_GEMINI_API_KEY (or GEMINI_API_KEY) in .env.");
}

const ai = new GoogleGenAI({ apiKey: geminiApiKey });

async function listModels() {
    try {
        const response = await ai.models.list();
        for await (const model of response) {
            if (model.name.includes("gemini")) {
                console.log(model.name);
            }
        }
    } catch (error) {
        console.error("Error fetching models:", error);
    }
}

listModels();
