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
  if (!question) return res.status(400).json({ error: 'Question required' });

  const systemPrompt = 'You are Prism, a helpful personal operating system assistant. Keep answers concise, calm, and actionable. Use bullet points if helpful.';
  const userContent = context ? `Context about my day:\n${context}\n\nQuestion: ${question}` : question;

  try {
    let answer = '';

    if (provider === 'gemini') {
      // ── GEMINI API ──
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userContent,
        config: {
          systemInstruction: systemPrompt,
        }
      });
      answer = response.text;
    } else {
      // ── GROQ API (OpenAI Compatible) ──
      const groq = new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1',
      });
      
      const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile', // Fast and very smart
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
    console.error(`[${provider.toUpperCase()} Error]`, error);
    res.status(500).json({ error: `Failed to contact ${provider}`, details: error.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Prism Backend running on port ${PORT}`));
