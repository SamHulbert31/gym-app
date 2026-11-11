// The AI layer. Features only ever see `AiProvider`; adding another provider later means one
// more file here and nothing changes elsewhere.

export type AiErrorKind = 'nokey' | 'quota' | 'auth' | 'network' | 'blocked' | 'invalid' | 'other';

// Plain words, never the key, never the raw response.
export class AiError extends Error {
  constructor(
    public kind: AiErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

export interface AiProvider {
  readonly name: string;
  /** Returns the model's text. With a schema the text is JSON matching it. */
  generate(prompt: string, jsonSchema?: Record<string, unknown>): Promise<string>;
}

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models';

export function geminiProvider(apiKey: string, model = DEFAULT_GEMINI_MODEL, fetchFn: typeof fetch = fetch): AiProvider {
  const modelName = model.trim() || DEFAULT_GEMINI_MODEL;
  return {
    name: `Gemini (${modelName})`,
    async generate(prompt, jsonSchema) {
      if (!apiKey.trim()) throw new AiError('nokey', 'No Gemini API key is set.');
      let res: Response;
      try {
        res = await fetchFn(`${GEMINI_API}/${encodeURIComponent(modelName)}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey.trim() },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              ...(jsonSchema ? { responseMimeType: 'application/json', responseJsonSchema: jsonSchema } : {}),
            },
          }),
        });
      } catch {
        throw new AiError('network', 'No connection to Gemini.');
      }
      // No retries on quota errors: the free tier resets on its own.
      if (res.status === 429) throw new AiError('quota', "Gemini's free quota is used up for now. Try again in a minute or two.");
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        throw new AiError('auth', 'Gemini rejected the request. Check the API key and the model name in Settings.');
      }
      if (res.status === 404) throw new AiError('auth', `Gemini does not know the model "${modelName}". Check the model name in Settings.`);
      if (!res.ok) throw new AiError('other', `Gemini returned status ${res.status}.`);

      let body: { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]; promptFeedback?: { blockReason?: string } };
      try {
        body = await res.json();
      } catch {
        throw new AiError('invalid', 'Gemini sent something that was not JSON.');
      }
      if (body.promptFeedback?.blockReason) throw new AiError('blocked', 'Gemini declined to answer this request.');
      const candidate = body.candidates?.[0];
      const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
      if (!text) {
        const why = candidate?.finishReason;
        throw new AiError(why === 'SAFETY' || why === 'BLOCKLIST' ? 'blocked' : 'invalid', `Gemini sent an empty answer${why ? ` (${why})` : ''}.`);
      }
      return text;
    },
  };
}
