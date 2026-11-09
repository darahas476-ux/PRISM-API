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

  const requestedProvider = provider.toLowerCase();
  if (requestedProvider !== 'gemini' && requestedProvider !== 'groq') {
    return res.status(400).json({ error: `Invalid provider '${provider}'. Must be 'gemini' or 'groq'.` });
  }

  const apiKey = requestedProvider === 'gemini' ? process.env.GEMINI_API_KEY : process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error(`[Config Error] Missing API key for ${requestedProvider}`);
    return res.status(500).json({ error: 'Server configuration error. API key missing.' });
  }

  const systemPrompt = `You are Prism, a helpful personal operating system assistant. Keep answers concise, calm, and actionable. Use bullet points if helpful.

  CRITICAL INSTRUCTION: You have the ability to control the user's app. If the user asks you to add a task, you MUST reply with exactly: "ACTION:ADD_TASK: [task name]" and nothing else. If they ask to start a focus session, reply exactly: "ACTION:START_FOCUS: [minutes]". Otherwise, just chat normally.`;
  const userContent = context ? `Context about my day:\n${context}\n\nQuestion: ${question}` : question;

  try {
    let answer = '';

    if (requestedProvider === 'gemini') {
      // ── GEMINI API ──
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
        model: 'openai/gpt-oss-120b', // Updated to the latest flagship model
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
    console.error(`[${requestedProvider.toUpperCase()} API Error]`, error);
    res.status(500).json({ error: 'The AI service is currently unavailable. Please try again later.' });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Prism Backend running on port ${PORT}`));