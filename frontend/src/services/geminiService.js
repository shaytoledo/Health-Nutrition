/**
 * services/geminiService.js — Gemini Vision called directly from the frontend.
 *
 * Every call is logged to Firestore (geminiLogs/*) with:
 *   - uid, email (who called)
 *   - type ('scan' | 'byName'), input (description of the input)
 *   - model (which Gemini model actually answered)
 *   - attempts (how many fallback models were tried)
 *   - promptChars, imageSizeKB (request size)
 *   - responseChars, responsePreview (first 300 chars of raw output)
 *   - tokensIn / tokensOut (from usageMetadata when available)
 *   - durationMs (round-trip time)
 *   - description, calories, proteinG, carbsG, fatG (parsed result on success)
 *   - error (message on failure)
 *   - ts (server timestamp)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_API_KEY } from '../config/appConfig';
import { logGeminiRequest } from './adminService';

let _currentUser = null;
export function setGeminiUser(user) { _currentUser = user || null; }

const SYSTEM_INSTRUCTION = `
You are a professional nutritionist and food recognition AI.
When given an image of food, you MUST respond with ONLY a valid JSON object.
Do NOT include markdown code fences, explanations, or any text outside the JSON.
`.trim();

const ANALYSIS_PROMPT = `
Analyze this food image and return a JSON object with EXACTLY these fields:
{
  "description": "<brief description of the dish, max 60 chars>",
  "calories": <integer kcal>,
  "proteinG": <integer grams protein>,
  "carbsG": <integer grams carbs>,
  "fatG": <integer grams fat>,
  "confidence": <float 0.0–1.0>
}
If the image does not contain food or is unrecognizable, return:
{"error": "UNRECOGNIZED", "description": ""}
`.trim();

const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-lite-latest',
];

/** Convert a File object or blob URL to base64. */
async function toBase64(source) {
  if (typeof source === 'string') {
    const res = await fetch(source);
    const buf = await res.arrayBuffer();
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = (e) => resolve(e.target.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(source);
  });
}

/** Build a base log entry so every path logs the same shape. */
function baseEntry(type, input, extra = {}) {
  return {
    uid:   _currentUser?.uid   || null,
    email: _currentUser?.email || null,
    type,
    input,
    ...extra,
  };
}

/** Retryable Gemini errors (server overloaded / quota / 5xx). */
const RETRYABLE = /\b(503|429|500|502|504|overloaded|unavailable|high demand|quota)\b/i;

/**
 * @param {File|string} imageSource
 * @param {string}      mimeType
 */
export async function analyzeFood(imageSource, mimeType = 'image/jpeg') {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
    throw new Error('Gemini API key not configured.');
  }

  const t0      = Date.now();
  const base64  = await toBase64(imageSource);
  const sizeKB  = Math.round((base64.length * 3 / 4) / 1024); // base64 → bytes → KB

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const input = `Image (${mimeType}, ${sizeKB} KB)`;

  let result, lastError, modelUsed = null, attempts = 0;
  for (const modelName of FALLBACK_MODELS) {
    attempts++;
    try {
      const model = genAI.getGenerativeModel({
        model: modelName, systemInstruction: SYSTEM_INSTRUCTION,
      });
      result    = await model.generateContent([
        ANALYSIS_PROMPT,
        { inlineData: { mimeType, data: base64 } },
      ]);
      modelUsed = modelName;
      break;
    } catch (e) {
      lastError = e;
      const msg = String(e?.message || e);
      if (!RETRYABLE.test(msg)) {
        logGeminiRequest(baseEntry('scan', input, {
          model: modelName, attempts, imageSizeKB: sizeKB,
          promptChars: ANALYSIS_PROMPT.length,
          error: msg, durationMs: Date.now() - t0,
        }));
        throw e;
      }
    }
  }
  if (!result) {
    logGeminiRequest(baseEntry('scan', input, {
      model: null, attempts, imageSizeKB: sizeKB,
      promptChars: ANALYSIS_PROMPT.length,
      error: String(lastError?.message || 'All Gemini models unavailable'),
      durationMs: Date.now() - t0,
    }));
    throw lastError || new Error('All Gemini models unavailable');
  }

  const rawText = result.response.text();
  const usage   = result.response.usageMetadata || {};
  const cleaned = rawText.replace(/```json|```/g, '').trim();
  let parsed;
  try { parsed = JSON.parse(cleaned); }
  catch (e) {
    logGeminiRequest(baseEntry('scan', input, {
      model: modelUsed, attempts, imageSizeKB: sizeKB,
      promptChars: ANALYSIS_PROMPT.length,
      responseChars: rawText.length,
      responsePreview: rawText.slice(0, 300),
      tokensIn: usage.promptTokenCount || null,
      tokensOut: usage.candidatesTokenCount || null,
      error: 'Invalid JSON from model: ' + (e?.message || ''),
      durationMs: Date.now() - t0,
    }));
    throw new Error('Invalid response format from Gemini');
  }

  const commonLog = {
    model: modelUsed, attempts, imageSizeKB: sizeKB,
    promptChars: ANALYSIS_PROMPT.length,
    responseChars: rawText.length,
    responsePreview: rawText.slice(0, 300),
    tokensIn:  usage.promptTokenCount     || null,
    tokensOut: usage.candidatesTokenCount || null,
    durationMs: Date.now() - t0,
  };

  if (parsed.error === 'UNRECOGNIZED') {
    logGeminiRequest(baseEntry('scan', input, { ...commonLog, error: 'UNRECOGNIZED' }));
    const err = new Error('Food not recognized'); err.code = 'FOOD_NOT_RECOGNIZED'; throw err;
  }

  const out = {
    description: parsed.description || 'Unknown food',
    calories:    Math.round(Number(parsed.calories) || 0),
    proteinG:    Math.round(Number(parsed.proteinG)  || 0),
    carbsG:      Math.round(Number(parsed.carbsG)    || 0),
    fatG:        Math.round(Number(parsed.fatG)      || 0),
    confidence:  parseFloat(parsed.confidence)       || 0,
  };
  logGeminiRequest(baseEntry('scan', input, {
    ...commonLog,
    description: out.description,
    calories: out.calories, proteinG: out.proteinG, carbsG: out.carbsG, fatG: out.fatG,
    confidence: out.confidence,
  }));
  return out;
}

/**
 * Estimate nutrition from food name + grams (text-only).
 */
export async function analyzeFoodByName(foodName, grams) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
    throw new Error('Gemini API key not configured.');
  }
  if (!foodName?.trim() || !grams || grams <= 0) {
    throw new Error('Food name and positive grams required.');
  }

  const t0 = Date.now();
  const prompt = `
Estimate nutrition for ${grams} grams of "${foodName}".
Return ONLY a valid JSON object with EXACTLY these fields:
{
  "description": "<food name + weight, e.g. 'Hamburger 200g'>",
  "calories": <integer kcal>,
  "proteinG": <integer grams protein>,
  "carbsG": <integer grams carbs>,
  "fatG": <integer grams fat>,
  "confidence": <float 0.0–1.0>
}
If the food is not recognizable, return: {"error": "UNRECOGNIZED", "description": ""}
Do NOT include markdown or any text outside the JSON.
`.trim();

  const input = `"${foodName}" — ${grams}g`;
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

  let result, lastError, modelUsed = null, attempts = 0;
  for (const modelName of FALLBACK_MODELS) {
    attempts++;
    try {
      const model = genAI.getGenerativeModel({
        model: modelName, systemInstruction: SYSTEM_INSTRUCTION,
      });
      result    = await model.generateContent(prompt);
      modelUsed = modelName;
      break;
    } catch (e) {
      lastError = e;
      const msg = String(e?.message || e);
      if (!RETRYABLE.test(msg)) {
        logGeminiRequest(baseEntry('byName', input, {
          model: modelName, attempts,
          promptChars: prompt.length,
          error: msg, durationMs: Date.now() - t0,
        }));
        throw e;
      }
    }
  }
  if (!result) {
    logGeminiRequest(baseEntry('byName', input, {
      model: null, attempts,
      promptChars: prompt.length,
      error: String(lastError?.message || 'All Gemini models unavailable'),
      durationMs: Date.now() - t0,
    }));
    throw lastError || new Error('All Gemini models unavailable');
  }

  const rawText = result.response.text();
  const usage   = result.response.usageMetadata || {};
  const cleaned = rawText.replace(/```json|```/g, '').trim();
  let parsed;
  try { parsed = JSON.parse(cleaned); }
  catch (e) {
    logGeminiRequest(baseEntry('byName', input, {
      model: modelUsed, attempts,
      promptChars: prompt.length,
      responseChars: rawText.length,
      responsePreview: rawText.slice(0, 300),
      tokensIn:  usage.promptTokenCount     || null,
      tokensOut: usage.candidatesTokenCount || null,
      error: 'Invalid JSON from model: ' + (e?.message || ''),
      durationMs: Date.now() - t0,
    }));
    throw new Error('Invalid response format from Gemini');
  }

  const commonLog = {
    model: modelUsed, attempts,
    promptChars: prompt.length,
    responseChars: rawText.length,
    responsePreview: rawText.slice(0, 300),
    tokensIn:  usage.promptTokenCount     || null,
    tokensOut: usage.candidatesTokenCount || null,
    durationMs: Date.now() - t0,
  };

  if (parsed.error === 'UNRECOGNIZED') {
    logGeminiRequest(baseEntry('byName', input, { ...commonLog, error: 'UNRECOGNIZED' }));
    const err = new Error('Food not recognized'); err.code = 'FOOD_NOT_RECOGNIZED'; throw err;
  }

  const out = {
    description: parsed.description || `${foodName} ${grams}g`,
    calories:    Math.round(Number(parsed.calories) || 0),
    proteinG:    Math.round(Number(parsed.proteinG)  || 0),
    carbsG:      Math.round(Number(parsed.carbsG)    || 0),
    fatG:        Math.round(Number(parsed.fatG)      || 0),
    confidence:  parseFloat(parsed.confidence)       || 0,
  };
  logGeminiRequest(baseEntry('byName', input, {
    ...commonLog,
    description: out.description,
    calories: out.calories, proteinG: out.proteinG, carbsG: out.carbsG, fatG: out.fatG,
    confidence: out.confidence,
  }));
  return out;
}
