import { createServer } from 'node:http';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';

process.env.NODE_ENV = 'test';

export const PROFILE = {
  age: 20, sex: 'male', heightCm: 172, weightKg: 62, goal: 'build_muscle', activityLevel: 'light',
  experience: 'beginner', diet: 'veg', living: 'hostel', kitchen: 'kettle', dailyBudget: 60,
  equipment: [], trainingDays: [0, 2, 4], minutesPerSession: 30, injuries: [], scheduleNote: '', foodNote: '',
};

export async function startDb() {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri('fitmentor-test'));
  return async () => {
    await mongoose.disconnect();
    await mongod.stop();
  };
}

let counter = 0;
export async function signUp(app, profile = PROFILE) {
  const agent = request.agent(app);
  counter += 1;
  const res = await agent.post('/api/auth/register').send({ name: 'Asha', email: `user${counter}-${Date.now()}@example.com`, password: 'password123' });
  if (res.status !== 201) throw new Error(`register failed: ${res.text}`);
  if (profile) {
    const saved = await agent.put('/api/profile').send(profile);
    if (saved.status !== 200) throw new Error(`profile failed: ${saved.text}`);
  }
  return agent;
}

/** A stand-in for an OpenAI-compatible provider. `reply` receives each request body. */
export async function fakeProvider(reply) {
  const requests = [];
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const body = JSON.parse(raw);
      requests.push(body);
      const out = reply(body, requests.length);
      res.writeHead(out.status ?? 200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(out.status ? { error: 'failed' } : { choices: [{ message: out }] }));
    });
  });
  await new Promise((r) => { server.listen(0, r); });
  return {
    requests,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((r) => { server.close(r); }),
  };
}
