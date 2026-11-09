import { config } from '../config.js';
import { HttpError } from '../lib/errors.js';

// Groq and Gemini both expose OpenAI-compatible chat completions, so one client
// serves both. Vision can select its preferred provider independently of text.
// Failed requests and invalid vision responses fall through to the backup.
const textProviders = () => [config.groq, config.gemini].filter((p) => p.apiKey && p.textModel);
const visionProviders = () => (config.visionProvider === 'gemini'
  ? [config.gemini, config.groq]
  : [config.groq, config.gemini]).filter((p) => p.apiKey && p.visionModel);

export const aiStatus = () => ({
  text: textProviders()[0]?.name ?? null,
  vision: visionProviders()[0]?.name ?? null,
});
export const textAvailable = () => textProviders().length > 0;
export const visionAvailable = () => visionProviders().length > 0;

async function call(provider, body) {
  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${provider.apiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.llmTimeoutMs),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new Error(`${provider.name} responded ${res.status}: ${detail}`);
  }
  const data = await res.json();
  const message = data.choices?.[0]?.message;
  if (!message) throw new Error(`${provider.name} returned no message`);
  return { message, provider: provider.name };
}

async function firstSuccessful(providers, build, validate = (result) => result) {
  for (const provider of providers) {
    try {
      return validate(await call(provider, build(provider)));
    } catch (err) {
      console.warn(`[llm] ${err.message}`);
    }
  }
  throw new HttpError(502, 'The AI service did not respond. Try again in a minute.', 'AI_FAILED');
}

/** One chat turn. Returns { message, provider }; message may contain tool_calls. */
export function chat({ messages, tools, temperature = 0.4, json = false }) {
  if (!textAvailable()) throw new HttpError(503, 'No AI key is configured.', 'AI_UNAVAILABLE');
  return firstSuccessful(textProviders(), (p) => ({
    model: p.textModel,
    messages,
    temperature,
    ...(tools?.length ? { tools, tool_choice: 'auto' } : {}),
    ...(json ? { response_format: { type: 'json_object' } } : {}),
  }));
}

export function parseJson(text) {
  const cleaned = String(text ?? '').replace(/```(?:json)?/gi, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('Model reply contained no JSON');
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

/** Asks for JSON and validates it against a zod schema. */
export async function chatJson({ system, user, schema, temperature = 0.3 }) {
  const { message, provider } = await chat({
    json: true,
    temperature,
    messages: [
      { role: 'system', content: `${system}\nReply with a single JSON object only.` },
      { role: 'user', content: user },
    ],
  });
  return { data: schema.parse(parseJson(message.content)), provider };
}

/** Sends an image with a prompt and validates the JSON reply. */
export async function visionJson({ system, prompt, imageBase64, mimeType, schema }) {
  if (!visionAvailable()) {
    throw new HttpError(503, 'Photo scanning isn’t available right now. You can type the meal instead.', 'AI_UNAVAILABLE');
  }
  return firstSuccessful(visionProviders(), (p) => ({
    model: p.visionModel,
    temperature: 0.1,
    max_completion_tokens: 4096,
    ...(p.name === 'groq' && p.visionModel === 'qwen/qwen3.8-27b' ? { reasoning_effort: 'none' } : {}),
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: `${system}\nReply with a single JSON object only.` },
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        ],
      },
    ],
  }), ({ message, provider }) => ({ data: schema.parse(parseJson(message.content)), provider }));
}
