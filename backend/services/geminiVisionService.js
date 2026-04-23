/**
 * services/geminiVisionService.js — Food recognition via Google Gemini Vision
 *
 * Sends a base64-encoded food photo to the Gemini 1.5 Flash model and parses
 * the structured nutritional response. The prompt is engineered to return a
 * strict JSON object so we can parse it reliably without string-matching.
 *
 * Supported image formats: JPEG, PNG, WebP (Gemini multi-modal constraint).
 * Maximum image size recommended: ~4 MB (larger images are automatically
 * downscaled by the Gemini API but may reduce accuracy).
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Lazy-initialize the client so missing env vars throw at call time, not startup
let genAI = null;

function getGenAI() {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not set.');
    }
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

// ---------------------------------------------------------------------------
// Prompt engineering
// ---------------------------------------------------------------------------

/**
 * System-level instruction that tells the model to always respond with
 * parseable JSON and nothing else. This prevents the model from adding
 * markdown fences or conversational text around the JSON.
 */
const SYSTEM_INSTRUCTION = `
You are a professional nutritionist and food recognition AI.
When given an image of food, you MUST respond with ONLY a valid JSON object.
Do NOT include markdown code fences, explanations, or any text outside the JSON.
`.trim();

/**
 * User prompt that specifies the exact schema we expect back.
 * Listing the fields explicitly reduces hallucination of extra keys.
 */
const ANALYSIS_PROMPT = `
Analyze this food image and return a JSON object with EXACTLY these fields:
{
  "description": "<brief English description of the dish, max 60 chars>",
  "calories": <integer, total kcal for the visible portion>,
  "proteinG": <integer, grams of protein>,
  "carbsG": <integer, grams of carbohydrates>,
  "fatG": <integer, grams of fat>,
  "confidence": <float 0.0–1.0, your confidence in the estimate>,
  "notes": "<any important caveats, e.g. 'portion size is an estimate'>"
}
If the image does not contain food or is too blurry to analyze, return:
{"error": "UNRECOGNIZED", "description": ""}
`.trim();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyzes a food photo and returns nutritional estimates.
 *
 * @param {Buffer|string} imageData  Raw image bytes (Buffer) or base64 string
 * @param {string} mimeType          MIME type: 'image/jpeg' | 'image/png' | 'image/webp'
 * @returns {Promise<object>} Nutritional data object, or throws on API failure
 *
 * @throws {Error} GEMINI_API_KEY missing
 * @throws {Error} Gemini API HTTP error
 * @throws {Error} Response is not valid JSON (should not happen with system instruction)
 */
async function analyzeFoodImage(imageData, mimeType = 'image/jpeg') {
  // Convert Buffer to base64 string if needed
  const base64Data = Buffer.isBuffer(imageData)
    ? imageData.toString('base64')
    : imageData;

  // Use gemini-1.5-flash for cost efficiency; upgrade to gemini-1.5-pro for
  // higher accuracy on ambiguous foods (at ~10x the token cost)
  const model = getGenAI().getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: SYSTEM_INSTRUCTION,
  });

  let rawText;
  try {
    const result = await model.generateContent([
      ANALYSIS_PROMPT,
      {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      },
    ]);

    rawText = result.response.text();
  } catch (apiError) {
    // Wrap API errors with a descriptive message so callers can distinguish
    // network failures from parsing failures
    throw new Error(`Gemini API call failed: ${apiError.message}`);
  }

  // Parse and validate the JSON response
  let parsed;
  try {
    // Strip any accidental code fences the model might still add
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (parseError) {
    throw new Error(
      `Failed to parse Gemini response as JSON. Raw response: "${rawText.substring(0, 200)}"`
    );
  }

  // If the model explicitly flagged the image as unrecognizable, surface that
  if (parsed.error === 'UNRECOGNIZED') {
    const err = new Error('Food not recognized: image is unclear or does not contain food.');
    err.code = 'FOOD_NOT_RECOGNIZED';
    err.statusCode = 422;
    throw err;
  }

  // Ensure all required numeric fields are present; default missing ones to 0
  return {
    description: parsed.description || 'Unknown food',
    calories: Math.round(Number(parsed.calories) || 0),
    proteinG: Math.round(Number(parsed.proteinG) || 0),
    carbsG: Math.round(Number(parsed.carbsG) || 0),
    fatG: Math.round(Number(parsed.fatG) || 0),
    confidence: parseFloat(parsed.confidence) || 0,
    notes: parsed.notes || '',
  };
}

module.exports = { analyzeFoodImage };
