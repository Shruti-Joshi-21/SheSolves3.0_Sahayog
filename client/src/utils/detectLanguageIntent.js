// Matches the language name regardless of surrounding sentence,
// and regardless of whether speech recognition transcribed it
// in Latin script (English) or Devanagari script (Hindi/Marathi).
const LANGUAGE_PATTERNS = [
  { code: 'mr', patterns: [/marath/i, /मराठी/] },
  { code: 'hi', patterns: [/hindi/i, /हिंदी/, /हिन्दी/] },
  { code: 'en', patterns: [/english/i, /angrez/i, /इंग्रजी/, /इंग्लिश/] },
];

export function detectLanguageIntent(transcript) {
  if (!transcript) return null;
  for (const { code, patterns } of LANGUAGE_PATTERNS) {
    if (patterns.some((p) => p.test(transcript))) {
      return code;
    }
  }
  return null;
}