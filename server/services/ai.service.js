/**
 * AI service — the ONE place the server talks to Gemini.
 *
 * Pattern for every AI feature (keeps the demo from ever breaking):
 *   1. Structured JSON output via a responseSchema
 *   2. Hard timeout
 *   3. Fallback object if anything fails (result.source === 'fallback')
 *
 * Usage:
 *   const { generateJSON, Type } = require('../services/ai.service');
 *   const result = await generateJSON({
 *     system: 'You review NGO field reports...',
 *     prompt: `Report text: ${report.text}`,
 *     imageUrls: report.images,                 // optional Cloudinary URLs (vision)
 *     schema: { type: Type.OBJECT, properties: { summary: { type: Type.STRING } }, required: ['summary'] },
 *     fallback: { summary: 'AI summary unavailable right now.' },
 *   });
 */
const axios = require('axios');
const { GoogleGenAI, Type } = require('@google/genai');

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const DEFAULT_TIMEOUT_MS = 25000;

let client = null;
function getClient() {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

async function imageUrlToPart(url) {
  const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
  const mimeType = resp.headers['content-type'] || 'image/jpeg';
  return { inlineData: { mimeType, data: Buffer.from(resp.data).toString('base64') } };
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`AI timed out after ${ms}ms`)), ms)),
  ]);
}

async function generateJSON({ system, prompt, schema, imageUrls = [], fallback = {}, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  try {
    const imageParts = await Promise.all(imageUrls.slice(0, 5).map(imageUrlToPart));
    const response = await withTimeout(
      getClient().models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts: [...imageParts, { text: prompt }] }],
        config: {
          systemInstruction: system,
          responseMimeType: 'application/json',
          ...(schema ? { responseSchema: schema } : {}),
          temperature: 0.3,
        },
      }),
      timeoutMs
    );
    return { ...JSON.parse(response.text), source: 'ai' };
  } catch (err) {
    console.error('[ai] generateJSON failed:', err.message);
    return { ...fallback, source: 'fallback' };
  }
}

async function generateText({ system, prompt, fallback = '', timeoutMs = DEFAULT_TIMEOUT_MS }) {
  try {
    const response = await withTimeout(
      getClient().models.generateContent({
        model: MODEL,
        contents: prompt,
        config: { systemInstruction: system, temperature: 0.4 },
      }),
      timeoutMs
    );
    return { text: response.text, source: 'ai' };
  } catch (err) {
    console.error('[ai] generateText failed:', err.message);
    return { text: fallback, source: 'fallback' };
  }
}

module.exports = { generateJSON, generateText, Type, MODEL };
