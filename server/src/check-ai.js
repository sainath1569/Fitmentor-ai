// Tests the configured keys and model IDs against the real providers.
// Run with: npm run check:ai
import { config } from './config.js';

// A 1x1 PNG, enough to prove the provider accepts image input.
const PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function attempt(provider, model, content) {
  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${provider.apiKey}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content }] }),
    signal: AbortSignal.timeout(30000),
  });
  if (res.ok) return 'ok';
  return `failed with ${res.status}: ${(await res.text()).slice(0, 200)}`;
}

let failed = false;
for (const provider of [config.gemini, config.groq]) {
  if (!provider.apiKey) {
    console.log(`${provider.name}: no key set`);
    continue;
  }
  const text = await attempt(provider, provider.textModel, 'Reply with the word ok.');
  console.log(`${provider.name} text (${provider.textModel}): ${text}`);
  failed ||= text !== 'ok';
  if (provider.visionModel) {
    const vision = await attempt(provider, provider.visionModel, [
      { type: 'text', text: 'What colour is this image?' },
      { type: 'image_url', image_url: { url: `data:image/png;base64,${PIXEL}` } },
    ]);
    console.log(`${provider.name} vision (${provider.visionModel}): ${vision}`);
    failed ||= vision !== 'ok';
  }
}
if (!config.gemini.apiKey && !config.groq.apiKey) console.log('Add a key to .env, then run this again.');
process.exit(failed ? 1 : 0);
