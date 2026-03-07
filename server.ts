import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = 3000;
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  // Middleware for parsing JSON and text
  app.use(express.json());
  app.use(express.text());

  // Logging middleware
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // API Endpoint for MT5 EA
  app.post("/api/analyze", async (req, res) => {
    const data = req.body;
    console.log("Received data from MT5 EA:", data);
    
    // Broadcast to all connected clients via Socket.io
    io.emit("mt5_data", {
      content: data,
      timestamp: new Date(),
    });

    // Automated AI Response for the EA
    try {
      const prompt = `Analizza i seguenti dati di trading provenienti da MetaTrader 5 e fornisci una risposta sintetica ed operativa (massimo 100 parole). Identifica Bias, Livelli e Rischio: \n\n${JSON.stringify(data)}`;
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: {
          systemInstruction: "Sei SOFTI AI AUTOMATION. Rispondi all'Expert Advisor con istruzioni chiare e concise basate sull'analisi dei dati ricevuti.",
        },
      });

      const aiResponse = response.text || "Analisi completata. Nessun segnale critico.";
      
      // Send back to EA
      res.json({ 
        status: "success", 
        ai_response: aiResponse,
        timestamp: new Date()
      });

      // Also broadcast the AI response to the web app
      io.emit("mt5_response", {
        content: aiResponse,
        timestamp: new Date()
      });

    } catch (error) {
      console.error("AI Automation Error:", error);
      res.json({ status: "error", message: "AI processing failed" });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
