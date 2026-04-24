/**
 * services/geminiService.js — Gemini Vision called directly from the frontend.
 *
 * Converts a File / blob-URL / native image to base64 and sends it to
 * gemini-1.5-flash for food recognition.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_API_KEY } from '../config/appConfig';
import { logGeminiRequest } from './adminService';

// Called by screens to pass the current user. Set once on login.
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

/** Convert a File object or blob URL to base64 string (no data-URL prefix). */
async function toBase64(source, mimeType) {
  if (typeof source === 'string') {
    // blob URL or remote URI — fetch it
    const res = await fetch(source);
    const buf = await res.arrayBuffer();
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
  }
  // File / Blob object
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(source);
  });
}

/**
 * @param {File|string} imageSource  File object (web) or URI string
 * @param {string}      mimeType     e.g. 'image/jpeg'
 */
export async function analyzeFood(imageSource, mimeType = 'image/jpeg') {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
    throw new Error('Gemini API key not configured. Add GEMINI_API_KEY in src/config/appConfig.js');
  }

  const _t0 = Date.now();
  const base64 = await toBase64(imageSource, mimeType);

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

  const FALLBACK_MODELS = [
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-2.0-flash',
    'gemini-2.5-flash-lite',
    'gemini-flash-lite-latest',
  ];

  let result, lastError;
  for (const modelName of FALLBACK_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model:             modelName,
        systemInstruction: SYSTEM_INSTRUCTION,
      });
      result = await model.generateContent([
        ANALYSIS_PROMPT,
        { inlineData: { mimeType, data: base64 } },
      ]);
      break;
    } catch (e) {
      lastError = e;
      const msg = String(e?.message || e);
      const retryable = /\b(503|429|500|502|504|overloaded|unavailable|high demand|quota)\b/i.test(msg);
      if (!retryable) {
        logGeminiRequest({
          uid: _currentUser?.uid, email: _currentUser?.email,
          type: 'scan', input: `image/${mimeType}`,
          error: msg, durationMs: Date.now() - _t0,
        });
        throw e;
      }
    }
  }
  if (!result) {
    logGeminiRequest({
      uid: _currentUser?.uid, email: _currentUser?.email,
      type: 'scan', input: `image/${mimeType}`,
      error: String(lastError?.message || 'All Gemini models unavailable'),
      durationMs: Date.now() - _t0,
    });
    throw lastError || new Error('All Gemini models unavailable');
  }

  const rawText = result.response.text();
  const cleaned = rawText.replace(/```json|```/g, '').trim();
  const parsed  = JSON.parse(cleaned);

  if (parsed.error === 'UNRECOGNIZED') {
    logGeminiRequest({
      uid: _currentUser?.uid, email: _currentUser?.email,
      type: 'scan', input: `image/${mimeType}`,
      error: 'UNRECOGNIZED', durationMs: Date.now() - _t0,
    });
    const err = new Error('Food not recognized');
    err.code = 'FOOD_NOT_RECOGNIZED';
    throw err;
  }

  const out = {
    description: parsed.description || 'Unknown food',
    calories:    Math.round(Number(parsed.calories) || 0),
    proteinG:    Math.round(Number(parsed.proteinG)  || 0),
    carbsG:      Math.round(Number(parsed.carbsG)    || 0),
    fatG:        Math.round(Number(parsed.fatG)      || 0),
    confidence:  parseFloat(parsed.confidence)       || 0,
  };
  logGeminiRequest({
    uid: _currentUser?.uid, email: _currentUser?.email,
    type: 'scan', input: `image/${mimeType}`,
    description: out.description, calories: out.calories,
    proteinG: out.proteinG, carbsG: out.carbsG, fatG: out.fatG,
    durationMs: Date.now() - _t0,
  });
  return out;
}

/**
 * Estimate nutrition from food name + grams (text-only, no image).
 * @param {string} foodName  e.g. "hamburger", "caesar salad", "white rice"
 * @param {number} grams     portion weight in grams
 */
export async function analyzeFoodByName(foodName, grams) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
    throw new Error('Gemini API key not configured.');
  }
  if (!foodName?.trim() || !grams || grams <= 0) {
    throw new Error('Food name and positive grams required.');
  }

  const _t0 = Date.now();
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

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const FALLBACK_MODELS = [
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-2.0-flash',
    'gemini-2.5-flash-lite',
    'gemini-flash-lite-latest',
  ];

  let result, lastError;
  for (const modelName of FALLBACK_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model:             modelName,
        systemInstruction: SYSTEM_INSTRUCTION,
      });
      result = await model.generateContent(prompt);
      break;
    } catch (e) {
      lastError = e;
      const msg = String(e?.message || e);
      const retryable = /\b(503|429|500|502|504|overloaded|unavailable|high demand|quota)\b/i.test(msg);
      if (!retryable) {
        logGeminiRequest({
          uid: _currentUser?.uid, email: _currentUser?.email,
          type: 'byName', input: `${foodName} ${grams}g`,
          error: msg, durationMs: Date.now() - _t0,
        });
        throw e;
      }
    }
  }
  if (!result) {
    logGeminiRequest({
      uid: _currentUser?.uid, email: _currentUser?.email,
      type: 'byName', input: `${foodName} ${grams}g`,
      error: String(lastError?.message || 'All Gemini models unavailable'),
      durationMs: Date.now() - _t0,
    });
    throw lastError || new Error('All Gemini models unavailable');
  }

  const rawText = result.response.text();
  const cleaned = rawText.replace(/```json|```/g, '').trim();
  const parsed  = JSON.parse(cleaned);

  if (parsed.error === 'UNRECOGNIZED') {
    logGeminiRequest({
      uid: _currentUser?.uid, email: _currentUser?.email,
      type: 'byName', input: `${foodName} ${grams}g`,
      error: 'UNRECOGNIZED', durationMs: Date.now() - _t0,
    });
    const err = new Error('Food not recognized');
    err.code = 'FOOD_NOT_RECOGNIZED';
    throw err;
  }

  const out = {
    description: parsed.description || `${foodName} ${grams}g`,
    calories:    Math.round(Number(parsed.calories) || 0),
    proteinG:    Math.round(Number(parsed.proteinG)  || 0),
    carbsG:      Math.round(Number(parsed.carbsG)    || 0),
    fatG:        Math.round(Number(parsed.fatG)      || 0),
    confidence:  parseFloat(parsed.confidence)       || 0,
  };
  logGeminiRequest({
    uid: _currentUser?.uid, email: _currentUser?.email,
    type: 'byName', input: `${foodName} ${grams}g`,
    description: out.description, calories: out.calories,
    proteinG: out.proteinG, carbsG: out.carbsG, fatG: out.fatG,
    durationMs: Date.now() - _t0,
  });
  return out;
}
