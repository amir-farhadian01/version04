import { GoogleGenAI } from '@google/genai';

export async function translateText(input: {
  text: string;
  sourceLang?: string;
  targetLang: string;
}): Promise<{ translatedText: string; detectedSourceLang: string | null }> {
  try {
    const source = input.sourceLang?.trim() || 'auto';
    const target = input.targetLang.trim().toLowerCase();
    if (!input.text.trim() || !target) {
      return { translatedText: input.text, detectedSourceLang: source === 'auto' ? null : source };
    }

    const key = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!key) {
      return { translatedText: input.text, detectedSourceLang: source === 'auto' ? null : source };
    }

    const ai = new GoogleGenAI({ apiKey: key });
    const prompt = [
      'Translate the following user message.',
      `Source language: ${source}`,
      `Target language: ${target}`,
      'Return valid JSON only with keys: translatedText (string), detectedSourceLang (string).',
      `Message: """${input.text}"""`,
    ].join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    const raw = response.text?.trim();
    if (!raw) {
      return { translatedText: input.text, detectedSourceLang: source === 'auto' ? null : source };
    }

    try {
      const parsed = JSON.parse(raw) as { translatedText?: unknown; detectedSourceLang?: unknown };
      const translatedText =
        typeof parsed.translatedText === 'string' && parsed.translatedText.trim()
          ? parsed.translatedText
          : input.text;
      const detectedSourceLang =
        typeof parsed.detectedSourceLang === 'string' && parsed.detectedSourceLang.trim()
          ? parsed.detectedSourceLang.trim().toLowerCase()
          : source === 'auto'
            ? null
            : source;
      return { translatedText, detectedSourceLang };
    } catch {
      return { translatedText: raw, detectedSourceLang: source === 'auto' ? null : source };
    }
  } catch {
    return {
      translatedText: input.text,
      detectedSourceLang: input.sourceLang?.trim().toLowerCase() ?? null,
    };
  }
}

