import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import request from 'supertest';
import { PROFILE, signUp, startDb } from './helpers.js';
import { config } from '../src/config.js';
import { createApp } from '../src/app.js';
import { addDays, mondayOf, today } from '../src/lib/dates.js';

config.groq.apiKey = '';
config.gemini.apiKey = '';
const app = createApp();
let stopDb;
before(async () => { stopDb = await startDb(); });
after(async () => { await stopDb(); });

const MEAL = {
  slot: 'lunch',
  items: [{ name: 'Dal', quantity: 1, kcal: 150, protein: 8, carbs: 20, fat: 4 }],
};

test('private routes need a session', async () => {
  assert.equal((await request(app).get('/api/today')).status, 401);
  assert.equal((await request(app).get('/api/meals')).status, 401);
});

test('duplicate emails and wrong passwords are refused', async () => {
  const email = `dup-${Date.now()}@example.com`;
  const body = { name: 'A', email, password: 'password123' };
  assert.equal((await request(app).post('/api/auth/register').send(body)).status, 201);
  assert.equal((await request(app).post('/api/auth/register').send(body)).status, 409);
  assert.equal((await request(app).post('/api/auth/login').send({ email, password: 'wrong-password' })).status, 401);
  const ok = await request(app).post('/api/auth/login').send({ email: email.toUpperCase(), password: 'password123' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.passwordHash, undefined);
  assert.match(ok.headers['set-cookie'][0], /HttpOnly/);
});

test('invalid profiles are refused, and the app waits for a profile', async () => {
  const agent = await signUp(app, null);
  assert.equal((await agent.get('/api/today')).body.code, 'PROFILE_REQUIRED');
  const res = await agent.put('/api/profile').send({ ...PROFILE, age: 12 });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /16/);
});

test('saving a profile assesses it and creates a first plan', async () => {
  const agent = await signUp(app);
  const { user } = (await agent.get('/api/auth/me')).body;
  assert.ok(user.assessment.targets.kcal > 1500);
  const plans = (await agent.get('/api/plans')).body;
  assert.equal(plans.current.sessions.length, 3);
  assert.equal(plans.current.generatedBy, 'rules');
  assert.ok(plans.current.trace.length >= 2);
});

test('logged meals change the day totals, and deleting restores them', async () => {
  const agent = await signUp(app);
  const date = today();
  const saved = await agent.post('/api/meals').send({ ...MEAL, date });
  assert.equal(saved.status, 201);
  const day = (await agent.get('/api/today')).body;
  assert.equal(day.totals.kcal, 150);
  assert.equal(day.remaining.kcal, day.targets.kcal - 150);
  assert.ok(day.suggestions.extras.length > 0);
  assert.equal((await agent.delete(`/api/meals/${saved.body.meal._id}`)).status, 204);
  assert.equal((await agent.get('/api/today')).body.totals.kcal, 0);
});

test('one student cannot reach another student\'s data', async () => {
  const owner = await signUp(app);
  const other = await signUp(app);
  const { meal } = (await owner.post('/api/meals').send({ ...MEAL, date: today() })).body;
  const plan = (await owner.get('/api/plans')).body.current;
  assert.equal((await other.delete(`/api/meals/${meal._id}`)).status, 404);
  assert.equal((await other.get(`/api/meals/${meal._id}/image`)).status, 404);
  const patch = await other.patch(`/api/plans/${plan._id}/sessions/${plan.sessions[0]._id}`).send({ status: 'done' });
  assert.equal(patch.status, 404);
  assert.equal((await owner.get('/api/today')).body.totals.kcal, 150);
});

test('typed meals work with no AI key', async () => {
  const agent = await signUp(app);
  const res = await agent.post('/api/meals/parse').send({ text: '3 idli, sambar and samosa' });
  assert.equal(res.status, 200);
  assert.equal(res.body.items.length, 3);
  assert.equal(res.body.totals.kcal, 180 + 110 + 260);
  assert.equal(res.body.swaps[0].from, 'Samosa');
});

test('photo scan explains what is missing without a key, and refuses non-images', async () => {
  const agent = await signUp(app);
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
  const noKey = await agent.post('/api/meals/analyze').attach('image', jpeg, 'meal.jpg');
  assert.equal(noKey.status, 503);
  assert.equal(noKey.body.code, 'AI_UNAVAILABLE');
  assert.match(noKey.body.error, /type the meal/);
  const fake = await agent.post('/api/meals/analyze').attach('image', Buffer.from('<script>alert(1)</script>'), { filename: 'meal.jpg', contentType: 'image/jpeg' });
  assert.equal(fake.status, 415);
});

test('logging a session is reflected in weekly stats', async () => {
  const agent = await signUp(app);
  const { current } = (await agent.get('/api/plans')).body;
  const res = await agent.patch(`/api/plans/${current._id}/sessions/${current.sessions[0]._id}`).send({ status: 'done', rpe: 7 });
  assert.equal(res.status, 200);
  const { week } = (await agent.get('/api/progress')).body;
  assert.equal(week.done, 1);
  assert.equal(week.avgRpe, 7);
});

test('regenerating a plan keeps sessions already logged', async () => {
  const agent = await signUp(app);
  const { current } = (await agent.get('/api/plans')).body;
  const first = current.sessions[0];
  await agent.patch(`/api/plans/${current._id}/sessions/${first._id}`).send({ status: 'done', rpe: 8 });
  const { plan } = (await agent.post('/api/plans/generate').send({ examWeek: true })).body;
  const kept = plan.sessions.find((s) => s.day === first.day);
  assert.equal(kept.status, 'done');
  assert.equal(kept.rpe, 8);
});

test('weekly review writes a report and next week\'s plan, and re-running does not stack calories', async () => {
  const agent = await signUp(app, { ...PROFILE, goal: 'lose_fat', weightKg: 70 });
  const week = mondayOf(today());
  await agent.post('/api/progress/weight').send({ weightKg: 72, date: addDays(week, -3) });
  await agent.post('/api/progress/weight').send({ weightKg: 70, date: today() });

  const first = await agent.post('/api/reports/weekly').send({});
  assert.equal(first.status, 201);
  assert.ok(first.body.report.summary.length > 20);
  assert.ok(first.body.report.trace.length >= 4);
  assert.equal(first.body.report.decisions.kcalChange, 150);

  const after1 = (await agent.get('/api/auth/me')).body.user;
  assert.equal(after1.calorieAdjustment, 150);
  await agent.post('/api/reports/weekly').send({});
  const after2 = (await agent.get('/api/auth/me')).body.user;
  assert.equal(after2.calorieAdjustment, 150);

  const plans = (await agent.get('/api/plans')).body;
  assert.equal(plans.next.weekStart, addDays(week, 7));
  assert.equal((await agent.get('/api/reports')).body.reports.length, 1);
});

test('coach answers from the knowledge base with no AI key', async () => {
  const agent = await signUp(app);
  const res = await agent.post('/api/coach/messages').send({ message: 'how do I train during exams?' });
  assert.equal(res.status, 201);
  assert.equal(res.body.reply.generatedBy, 'rules');
  assert.deepEqual(res.body.reply.sources, ['Training through exams']);
  assert.equal((await agent.get('/api/coach/messages')).body.messages.length, 2);
});

test('coach responds to distress with support, not diet advice', async () => {
  const agent = await signUp(app);
  const res = await agent.post('/api/coach/messages').send({ message: 'I want to starve myself to lose weight fast' });
  assert.equal(res.body.reply.generatedBy, 'safety');
  assert.match(res.body.reply.content, /14416/);
});
