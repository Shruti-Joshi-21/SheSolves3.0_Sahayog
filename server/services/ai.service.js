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

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
// Used when MODEL is overloaded (503 / 429) — 'off' disables the second attempt
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash';
const DEFAULT_TIMEOUT_MS = 25000;
const MIN_RETRY_MS = 5000; // don't start a fallback-model attempt with less time than this

const isOverloaded = (err) =>
  [429, 503].includes(err?.status) || /\b(429|503)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded/i.test(err?.message || '');

// Tries MODEL, then FALLBACK_MODEL if MODEL is overloaded — all within one shared deadline.
async function callWithFallback(buildRequest, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  const models = [MODEL];
  if (FALLBACK_MODEL && FALLBACK_MODEL !== 'off' && FALLBACK_MODEL !== MODEL) models.push(FALLBACK_MODEL);

  let lastErr;
  for (const model of models) {
    const remaining = deadline - Date.now();
    if (model !== MODEL && remaining < MIN_RETRY_MS) break;
    try {
      return await withTimeout(getClient().models.generateContent(buildRequest(model)), remaining);
    } catch (err) {
      lastErr = err;
      if (!isOverloaded(err)) break;
      console.warn(`[ai] ${model} overloaded — ${models.length > 1 && model === MODEL ? `retrying on ${FALLBACK_MODEL}` : 'giving up'}`);
    }
  }
  throw lastErr;
}

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
    const response = await callWithFallback(
      (model) => ({
        model,
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
    const response = await callWithFallback(
      (model) => ({
        model,
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

module.exports = { generateJSON, generateText, Type, MODEL, FALLBACK_MODEL };
