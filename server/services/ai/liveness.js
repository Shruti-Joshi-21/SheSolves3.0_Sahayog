/**
 * Liveness check (Challenge 3) — Gemini vision compares two face frames taken a few
 * seconds apart while the worker performs a random action (blink, turn head, raise hand).
 *
 * Never fails the check-in: missing frames, AI errors and low-confidence answers all
 * return livenessPassed: null ("not checked" → neutral in the trust score).
 */
const { generateJSON, Type } = require('../ai.service');

// Gemini vision on 2 frames takes ~10–20s under load; runs in parallel with face verification
const LIVENESS_TIMEOUT_MS = 30000;
const MIN_CONFIDENCE = 0.4; // below this the verdict is treated as inconclusive

const SYSTEM = `You are an anti-spoofing checker for an NGO attendance app.
You get two photos from a phone's front camera, taken about 3 seconds apart.
Between the two photos the worker was asked to perform an action.
Judge strictly from what is visible. Be fair to poor lighting and low-cost phone cameras;
only call it a spoof if there are real signs (screen bezel, moiré pattern, glare on a flat surface,
paper edges, a photo held in a hand, identical frames with no natural movement).`;

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    samePerson: { type: Type.BOOLEAN, description: 'Both frames show the same real person' },
    actionPerformed: { type: Type.BOOLEAN, description: 'The requested action visibly happened between frame 1 and frame 2' },
    spoofSuspected: { type: Type.BOOLEAN, description: 'Signs of a photo of a screen/print, mask or replayed image' },
    confidence: { type: Type.NUMBER, description: 'Confidence in this verdict, 0 to 1' },
    reason: { type: Type.STRING, description: 'One short sentence explaining the verdict' },
  },
  required: ['samePerson', 'actionPerformed', 'spoofSuspected', 'confidence', 'reason'],
};

const neutral = (reason, source = 'fallback') => ({
  livenessPassed: null,
  confidence: null,
  reason,
  source,
});

/**
 * @param {{ frame1Url: string, frame2Url: string, action: string }} p
 * @returns {Promise<{ livenessPassed: boolean|null, confidence: number|null, reason: string, source: 'ai'|'fallback' }>}
 */
async function checkLiveness({ frame1Url, frame2Url, action }) {
  if (!frame1Url || !frame2Url) return neutral('Liveness frames not provided');

  const requested = action || 'any natural movement';
  const result = await generateJSON({
    system: SYSTEM,
    prompt: `Image 1 is frame 1 (before). Image 2 is frame 2 (after).
Requested action: "${requested}".
Answer: are both frames the same real person, was the requested action visibly performed between the frames,
and is there any sign this is a photo of a screen/print rather than a live person?`,
    imageUrls: [frame1Url, frame2Url], // webcam frames are already small (~30 KB)
    schema: SCHEMA,
    fallback: {},
    timeoutMs: LIVENESS_TIMEOUT_MS,
  });

  if (result.source !== 'ai' || typeof result.samePerson !== 'boolean') {
    return neutral('AI liveness check unavailable — not scored');
  }

  const confidence = Math.max(0, Math.min(1, Number(result.confidence) || 0));
  if (confidence < MIN_CONFIDENCE) {
    return neutral(`Inconclusive: ${result.reason || 'low confidence'}`, 'ai');
  }

  const livenessPassed = result.samePerson && result.actionPerformed && !result.spoofSuspected;
  let reason = result.reason || '';
  if (!livenessPassed && !reason) {
    if (result.spoofSuspected) reason = 'Looks like a photo of a screen or print';
    else if (!result.samePerson) reason = 'Frames show different people';
    else reason = `Action "${requested}" not visible`;
  }
  return { livenessPassed, spoofSuspected: !!result.spoofSuspected, confidence, reason, source: 'ai' };
}

module.exports = { checkLiveness };
