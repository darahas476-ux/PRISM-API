const express = require('express');
const cors = require('cors');
require('dotenv').config();
const OpenAI = require('openai');
const { GoogleGenAI } = require('@google/genai');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'prism-backend' }));

app.post('/api/ask', async (req, res) => {
  const { question, context, provider = 'groq' } = req.body;
  
  if (!question) {
    return res.status(400).json({ error: 'Question required' });
  }

  // ── Problem 4: Strict Provider Validation ──
  const requestedProvider = provider.toLowerCase();
  if (requestedProvider !== 'gemini' && requestedProvider !== 'groq') {
    return res.status(400).json({ error: `Invalid provider '${provider}'. Must be 'gemini' or 'groq'.` });
  }

  // ── Problem 3: Missing API key validation ──
  const apiKey = requestedProvider === 'gemini' ? process.env.GEMINI_API_KEY : process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error(`[Config Error] Missing API key for ${requestedProvider}`);
    return res.status(500).json({ error: 'Server configuration error. API key missing.' });
  }

  const systemPrompt = 'You are Prism, a helpful personal operating system assistant. Keep answers concise, calm, and actionable. Use bullet points if helpful.';
  const userContent = context ? `Context about my day:\n${context}\n\nQuestion: ${question}` : question;

  try {
    let answer = '';

    if (requestedProvider === 'gemini') {
      // ── GEMINI API ──
      // Problem 2: gemini-3.8-flash is valid, keeping it.
      const ai = new GoogleGenAI({ apiKey: apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash', 
        contents: userContent,
        config: {
          systemInstruction: systemPrompt,
        }
      });
      answer = response.text;
    } else {
      // ── GROQ API ──
      const groq = new OpenAI({
        apiKey: apiKey,
        baseURL: 'https://api.groq.com/openai/v1',
      });
      
      const response = await groq.chat.completions.create({
        model: 'openai/gpt-oss-20b', // Problem 1: Updated to supported model
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        max_tokens: 300,
      });
      answer = response.choices[0].message.content;
    }

    res.json({ answer });
  } catch (error) {
    // ── Problem 5: Controlled error handling ──
    // Log the full technical details on the server...
    console.error(`[${requestedProvider.toUpperCase()} API Error]`, error);
    
    // ...but return a clean, generic message to the Flutter client.
    res.status(500).json({ error: 'The AI service is currently unavailable. Please try again later.' });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Prism Backend running on port ${PORT}`));