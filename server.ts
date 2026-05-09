import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
});

if (!process.env.GEMINI_API_KEY) {
  console.warn("Warning: GEMINI_API_KEY is not set. AI endpoints will fail.");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.post("/api/ai/writing-guidance", async (req, res) => {
    const { word, meaning, previousSentences } = req.body;
    if (!word || !meaning) {
      return res.status(400).json({ error: "Missing required fields: word, meaning." });
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: `Word: ${word}\nMeaning: ${meaning}\nHistory: ${previousSentences.join("; ")}\nProvide guidance in the requested format.` }] }],
        config: {
          systemInstruction: `You are a sharp, concise writing mentor. STOP generating long essays or poetic lectures. 
          
          MANDATORY STRUCTURE:
          Quick Insight: [1 short observation]
          Try: • [idea 1] • [idea 2]
          Refinement Tip: [1 concise hint]
          
          STRICT LIMIT: Under 80 words. Be fast and useful.`,
          responseMimeType: "text/plain"
        }
      });
      return res.json({ guidance: response.text?.trim() || "" });
    } catch (error) {
      console.error("AI guidance error:", error);
      return res.status(500).json({ error: "AI guidance request failed." });
    }
  });

  app.post("/api/ai/analyze-sentence", async (req, res) => {
    const { word, meaning, sentence, previousSentences } = req.body;
    if (!word || !meaning || !sentence) {
      return res.status(400).json({ error: "Missing required fields: word, meaning, sentence." });
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: `Word: ${word}\nMeaning: ${meaning}\nSentence: "${sentence}"\nPrevious: ${previousSentences.join("; ")}` }] }],
        config: {
          systemInstruction: `You are a sharp, fast writing editor. Override all previous stylistic behavior. No philosophical explorations.
          
          STRICT RULES:
          1. IDEA PRESERVATION: Polish the user's idea, don't replace it.
          2. CONCISE: Absolute max 120 words. Focus on being useful.
          
          STRUCTURE:
          - "whatWorks": 1 short sentence starting with "✓ Your idea..."
          - "whatSoundsUnnatural": 1 short correction starting with "△ Improve..."
          - "suggestedRefinement": The improved version preserving same idea ("Better flow")
          - "advancedInsight": 1 concise insight ("Advanced tip")
          - "exemplarySentence": Same context as user, but elite level.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              evaluation: { type: Type.STRING },
              whatWorks: { type: Type.STRING },
              whatSoundsUnnatural: { type: Type.STRING },
              suggestedRefinement: { type: Type.STRING },
              advancedInsight: { type: Type.STRING },
              exemplarySentence: { type: Type.STRING }
            },
            required: ["evaluation", "whatWorks", "whatSoundsUnnatural", "suggestedRefinement", "advancedInsight", "exemplarySentence"]
          }
        }
      });

      const payload = response.text || "{}";
      try {
        return res.json(JSON.parse(payload));
      } catch (parseError) {
        console.error("Invalid AI analyze response:", payload, parseError);
        return res.status(502).json({ error: "Invalid AI response format." });
      }
    } catch (error) {
      console.error("AI analyze error:", error);
      return res.status(500).json({ error: "AI analyze request failed." });
    }
  });

  app.post("/api/ai/practice-sentence", async (req, res) => {
    const { word, meaning } = req.body;
    if (!word || !meaning) {
      return res.status(400).json({ error: "Missing required fields: word, meaning." });
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: `Create a useful, clear practice sentence for the word "${word}" (meaning: ${meaning}). The sentence should be high-quality and demonstrate the word's correct usage in an elegant way.` }] }],
        config: {
          systemInstruction: "You are a master of linguistic context. Provide only the sentence itself. No intro, no quotes, no extra notes.",
          responseMimeType: "text/plain"
        }
      });
      return res.json({ sentence: response.text?.trim() || "" });
    } catch (error) {
      console.error("AI practice sentence error:", error);
      return res.status(500).json({ error: "AI practice sentence request failed." });
    }
  });

  app.post("/api/ai/word-details", async (req, res) => {
    const { word } = req.body;
    if (!word) {
      return res.status(400).json({ error: "Missing required field: word." });
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: `Provide deep insights for the word: "${word}".` }] }],
        config: {
          systemInstruction: "You are an expert etymologist and linguist. Provide a comprehensive, academic but accessible breakdown of the given word. Focus on deep contextual usage and interesting etymological origins.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              term: { type: Type.STRING },
              phonetic: { type: Type.STRING },
              definition: { type: Type.STRING },
              partOfSpeech: { type: Type.STRING },
              examples: { type: Type.ARRAY, items: { type: Type.STRING } },
              etymology: { type: Type.STRING },
              synonyms: { type: Type.ARRAY, items: { type: Type.STRING } },
              antonyms: { type: Type.ARRAY, items: { type: Type.STRING } },
              difficulty: { type: Type.STRING, enum: ["simple", "intermediate", "advanced", "expert"] },
              usageDepth: { type: Type.STRING, description: "A deep dive into how the word is used in different contexts (e.g., formal vs informal)." }
            },
            required: ["term", "definition", "phonetic", "partOfSpeech"]
          }
        }
      });

      const payload = response.text || "{}";
      try {
        const details = JSON.parse(payload);
        details.examples = details.examples || [];
        details.synonyms = details.synonyms || [];
        details.antonyms = details.antonyms || [];
        return res.json(details);
      } catch (parseError) {
        console.error("Invalid AI word details response:", payload, parseError);
        return res.status(502).json({ error: "Invalid AI response format." });
      }
    } catch (error) {
      console.error("AI word details error:", error);
      return res.status(500).json({ error: "AI word details request failed." });
    }
  });

  app.post("/api/ai/suggest-daily-word", async (req, res) => {
    const { level, difficulty = 'intermediate', exclusionList = [] } = req.body;
    if (typeof level !== 'number') {
      return res.status(400).json({ error: "Missing required field: level." });
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: `Suggest a daily vocabulary word for a user at level ${level} with a preference for ${difficulty} difficulty.\nIMPORTANT: Do NOT suggest any of these words: ${exclusionList.join(", ")}.` }] }],
        config: {
          systemInstruction: "Suggest only the single word. No periods, no extra text. Pick something evocative and useful.",
          responseMimeType: "text/plain"
        }
      });
      const word = (response.text || "").trim().toLowerCase().replace(/[^a-z]/g, '');
      return res.json({ word });
    } catch (error) {
      console.error("AI suggest daily word error:", error);
      return res.status(500).json({ error: "AI suggest word request failed." });
    }
  });

  app.post("/api/ai/verify-review", async (req, res) => {
    const { word, userMeaning, sentences } = req.body;
    if (!word || !userMeaning || !Array.isArray(sentences) || sentences.length < 2) {
      return res.status(400).json({ error: "Missing required fields: word, userMeaning, sentences." });
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: `Verify if the user understands the word "${word}". \nUser's provided meaning: "${userMeaning}"\nUser's provided sentences:\n1. "${sentences[0]}"\n2. "${sentences[1]}"` }] }],
        config: {
          systemInstruction: `You are a linguistic evaluator. Check if the meaning is accurate and the sentences are grammatically correct and use the word correctly in context. \nRespond in JSON format.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              passed: { type: Type.BOOLEAN },
              feedback: { type: Type.STRING, description: "Constructive feedback if they failed or praise if they passed." }
            },
            required: ["passed", "feedback"]
          }
        }
      });

      const payload = response.text || "{}";
      try {
        return res.json(JSON.parse(payload));
      } catch (parseError) {
        console.error("Invalid AI verify review response:", payload, parseError);
        return res.status(502).json({ error: "Invalid AI response format." });
      }
    } catch (error) {
      console.error("AI verify review error:", error);
      return res.status(500).json({ error: "AI verify review request failed." });
    }
  });

  app.post("/api/ai/generate-quiz", async (req, res) => {
    const { words } = req.body;
    if (!Array.isArray(words) || words.length === 0) {
      return res.status(400).json({ error: "Missing required field: words." });
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: `Generate a 5-question multiple choice quiz to test mastery of these words: ${words.join(", ")}.` }] }],
        config: {
          systemInstruction: "Create challenging questions that test contextual understanding, not just definitions.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctIndex: { type: Type.NUMBER },
                explanation: { type: Type.STRING }
              },
              required: ["question", "options", "correctIndex", "explanation"]
            }
          }
        }
      });

      const payload = response.text || "[]";
      try {
        return res.json(JSON.parse(payload));
      } catch (parseError) {
        console.error("Invalid AI quiz response:", payload, parseError);
        return res.status(502).json({ error: "Invalid AI response format." });
      }
    } catch (error) {
      console.error("AI quiz error:", error);
      return res.status(500).json({ error: "AI quiz request failed." });
    }
  });

  // Vite middleware for development
  console.log(`Starting server in ${process.env.NODE_ENV || 'development'} mode`);
  
  if (process.env.NODE_ENV !== "production") {
    console.log("Initializing Vite dev middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    console.log(`Serving static files from: ${distPath}`);
    
    app.use(express.static(distPath));
    
    app.get("*", (req, res) => {
      const indexPath = path.join(distPath, "index.html");
      console.log(`Fallback: Sending ${indexPath} for request ${req.url}`);
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error(`Error sending index.html: ${err.message}`);
          res.status(500).send("Server Error: Missing index.html");
        }
      });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
