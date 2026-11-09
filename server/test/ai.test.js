import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fakeProvider, PROFILE, signUp, startDb } from './helpers.js';
import { config } from '../src/config.js';
import { createApp } from '../src/app.js';
import { Weight } from '../src/models/index.js';

// These tests run the real AI code paths against a local fake provider. They prove
// the wiring, not the quality of any real model's answers.
const app = createApp();
let stopDb;
let provider;
let handler;

before(async () => {
  stopDb = await startDb();
  provider = await fakeProvider((body, n) => handler(body, n));
  config.groq.apiKey = 'test';
  config.groq.baseUrl = provider.baseUrl;
  config.gemini.apiKey = '';
  config.gemini.visionModel = 'fake-vision';
});
after(async () => {
  await provider.close();
  await stopDb();
});

const text = (content) => ({ role: 'assistant', content });
const toolCall = (name, args, id = 'call_1') => ({
  role: 'assistant', content: null,
  tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }],
});
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);

async function plainAgent() {
  handler = () => text('{"summary":"A short summary long enough to pass validation here."}');
  return signUp(app);
}

test('coach calls tools, feeds results back and cites sources', async () => {
  const agent = await plainAgent();
  handler = (_body, n) => (n % 2 ? toolCall('search_knowledge', { query: 'cheap protein' }) : text('Buy soya chunks.'));
  provider.requests.length = 0;
  const res = await agent.post('/api/coach/messages').send({ message: 'cheap protein?' });
  assert.equal(res.body.reply.content, 'Buy soya chunks.');
  assert.deepEqual(res.body.reply.toolsUsed, ['search_knowledge']);
  assert.ok(res.body.reply.sources.includes('Cheap protein per rupee'));
  const second = provider.requests[1].messages;
  assert.equal(second.at(-1).role, 'tool');
  assert.equal(second.at(-2).tool_calls[0].id, 'call_1');
});

test('coach tool can log weight, and bad tool input does not save', async () => {
  const agent = await plainAgent();
  handler = (_body, n) => (n % 2 ? toolCall('log_weight', { weightKg: 64.5 }) : text('Saved.'));
  provider.requests.length = 0;
  await agent.post('/api/coach/messages').send({ message: 'I weigh 64.5 today' });
  assert.equal((await agent.get('/api/progress')).body.weights.at(-1).weightKg, 64.5);

  const before2 = await Weight.countDocuments();
  handler = (_body, n) => (n % 2 ? toolCall('log_weight', { weightKg: 9999 }) : text('That looks wrong.'));
  provider.requests.length = 0;
  await agent.post('/api/coach/messages').send({ message: 'log 9999' });
  assert.equal(await Weight.countDocuments(), before2);
});

test('coach stops a runaway tool loop', async () => {
  const agent = await plainAgent();
  handler = (body) => (body.tools ? toolCall('get_today', {}) : text('Here is what I have.'));
  provider.requests.length = 0;
  const res = await agent.post('/api/coach/messages').send({ message: 'hi' });
  assert.equal(res.body.reply.content, 'Here is what I have.');
  assert.equal(provider.requests.length, 6);
});

test('coach falls back to offline answers when the provider fails', async () => {
  const agent = await plainAgent();
  handler = () => ({ status: 500 });
  const res = await agent.post('/api/coach/messages').send({ message: 'how do I sleep better' });
  assert.equal(res.status, 201);
  assert.equal(res.body.reply.generatedBy, 'rules');
});

test('coach safety guard never reaches the provider', async () => {
  const agent = await plainAgent();
  provider.requests.length = 0;
  await agent.post('/api/coach/messages').send({ message: 'I want to stop eating' });
  assert.equal(provider.requests.length, 0);
});

test('photo analysis grounds known dishes in the food table', async () => {
  const agent = await plainAgent();
  config.groq.visionModel = 'fake-vision';
  handler = () => text(JSON.stringify({
    isFood: true,
    items: [
      { name: 'roti', servings: 2, portion: '2 rotis', confidence: 0.9, kcal: 999, protein: 99, carbs: 99, fat: 99 },
      { name: 'mystery kofta', servings: 1, portion: '1 bowl', confidence: 0.4, kcal: 300, protein: 8, carbs: 20, fat: 18 },
    ],
  }));
  provider.requests.length = 0;
  const res = await agent.post('/api/meals/analyze').attach('image', JPEG, 'meal.jpg');
  assert.equal(res.status, 200);
  const [roti, kofta] = res.body.items;
  assert.equal(roti.kcal, 220);
  assert.equal(roti.source, 'knowledge');
  assert.equal(kofta.kcal, 300);
  assert.equal(kofta.source, 'ai');
  assert.match(provider.requests[0].messages[1].content[1].image_url.url, /^data:image\/jpeg;base64,/);
  assert.ok(res.body.imageToken);
});

test('photos with no food are explained', async () => {
  const agent = await plainAgent();
  handler = () => text('{"isFood":false,"items":[]}');
  const res = await agent.post('/api/meals/analyze').attach('image', JPEG, 'wall.jpg');
  assert.equal(res.status, 422);
});

test('malformed vision output becomes a clean error', async () => {
  const agent = await plainAgent();
  handler = () => text('sorry, I cannot help');
  const res = await agent.post('/api/meals/analyze').attach('image', JPEG, 'meal.jpg');
  assert.ok(res.status >= 500 && res.status < 600);
  assert.ok(res.body.error);
  assert.doesNotMatch(res.body.error, /JSON/);
});

test('photo scanning prefers the selected Groq vision model', async () => {
  const agent = await plainAgent();
  const saved = { gemini: { ...config.gemini }, model: config.groq.visionModel, preferred: config.visionProvider };
  const backup = await fakeProvider(() => text('{"isFood":false,"items":[]}'));
  try {
    config.visionProvider = 'groq';
    config.groq.visionModel = 'qwen/qwen3.8-27b';
    Object.assign(config.gemini, { apiKey: 'test', baseUrl: backup.baseUrl });
    handler = () => text('{"isFood":false,"items":[]}');
    provider.requests.length = 0;
    const res = await agent.post('/api/meals/analyze').attach('image', JPEG, 'wall.jpg');
    assert.equal(res.status, 422);
    assert.equal(provider.requests[0].model, 'qwen/qwen3.8-27b');
    assert.equal(provider.requests[0].reasoning_effort, 'none');
    assert.equal(backup.requests.length, 0, 'A valid no-food result must not be retried with another provider');
  } finally {
    Object.assign(config.gemini, saved.gemini);
    config.groq.visionModel = saved.model;
    config.visionProvider = saved.preferred;
    await backup.close();
  }
});

test('photo scanning tries the backup for provider and response failures', async (t) => {
  for (const [name, reply] of [
    ['rate limit', { status: 429 }],
    ['malformed JSON', text('not a JSON reply')],
    ['invalid food schema', text('{"isFood":true,"items":[{"name":"dal"}]}')],
  ]) {
    await t.test(name, async () => {
      const agent = await plainAgent();
      const saved = { gemini: { ...config.gemini }, preferred: config.visionProvider };
      const backup = await fakeProvider(() => text(JSON.stringify({ isFood: true, items: [
        { name: 'dal', servings: 1, confidence: 0.85, kcal: 150, protein: 8, carbs: 20, fat: 4 },
      ] })));
      try {
        config.visionProvider = 'groq';
        Object.assign(config.gemini, { apiKey: 'test', baseUrl: backup.baseUrl });
        handler = () => reply;
        const res = await agent.post('/api/meals/analyze').attach('image', JPEG, 'meal.jpg');
        assert.equal(res.status, 200);
        assert.equal(res.body.provider, 'gemini');
        assert.equal(res.body.items[0].foodId, 'dal');
        assert.equal(res.body.items[0].source, 'knowledge');
        assert.equal(backup.requests.length, 1);
      } finally {
        Object.assign(config.gemini, saved.gemini);
        config.visionProvider = saved.preferred;
        await backup.close();
      }
    });
  }
});

test('planner keeps valid swaps, blocks unsafe ones and records it', async () => {
  const agent = await signUp(app, { ...PROFILE, injuries: ['knee'] });
  const { current } = (await agent.get('/api/plans')).body;
  const session = current.sessions[0];
  const pushId = session.exercises.find((x) => /push/i.test(x.exerciseId))?.exerciseId;
  handler = () => text(JSON.stringify({
    rationale: 'This plan fits your knee limits and your room setup.',
    swaps: [
      { day: session.day, removeId: pushId, addId: 'pike-pushup' },
      { day: session.day, removeId: session.exercises[0].exerciseId, addId: 'barbell-squat' },
    ],
  }));
  const { plan } = (await agent.post('/api/plans/generate').send({ note: 'exams next week' })).body;
  const ids = plan.sessions.flatMap((s) => s.exercises.map((x) => x.exerciseId));
  assert.ok(!ids.includes('barbell-squat'));
  assert.equal(plan.generatedBy, 'groq');
  assert.ok(plan.trace.some((t) => t.agent === 'Safety check'));
});

test('planner falls back to the rule plan on invalid AI output', async () => {
  const agent = await plainAgent();
  handler = () => text('{"rationale": 5}');
  const { plan } = (await agent.post('/api/plans/generate').send({})).body;
  assert.equal(plan.generatedBy, 'rules');
  assert.equal(plan.sessions.length, 3);
});

test('text falls through to the second provider', async () => {
  const agent = await plainAgent();
  const backup = await fakeProvider(() => text('Backup answer.'));
  const original = { ...config.gemini };
  Object.assign(config.gemini, { apiKey: 'test', baseUrl: backup.baseUrl });
  handler = () => ({ status: 429 });
  const res = await agent.post('/api/coach/messages').send({ message: 'hello' });
  Object.assign(config.gemini, original);
  await backup.close();
  assert.equal(res.body.reply.content, 'Backup answer.');
  assert.equal(res.body.reply.generatedBy, 'gemini');
});
