// Creates demo@fitmentor.app with three weeks of history, for demos and screenshots.
// All data here is made up. Run with: npm run seed
import bcrypt from 'bcryptjs';
import { assessProfile } from './agents/assessor.js';
import { fromKnowledge } from './agents/nutrition.js';
import { generatePlan, runWeeklyReview } from './agents/orchestrator.js';
import { foodById } from './ai/retriever.js';
import { connectDb, disconnectDb } from './db.js';
import { addDays, mondayOf, today, weekdayIndex } from './lib/dates.js';
import { ChatMessage, Meal, Plan, Report, User, Weight } from './models/index.js';

const EMAIL = 'demo@fitmentor.app';
const PASSWORD = 'demo12345';
const profile = {
  age: 20, sex: 'male', heightCm: 172, weightKg: 63.4, goal: 'build_muscle', activityLevel: 'light',
  experience: 'beginner', diet: 'egg', living: 'hostel', kitchen: 'kettle', dailyBudget: 60,
  equipment: ['pullup_bar', 'bands'], trainingDays: [0, 2, 4, 5], minutesPerSession: 35, injuries: [],
  scheduleNote: 'Labs until 5pm on Tuesdays and Thursdays', foodNote: 'Mess serves eggs on Wednesday and Sunday',
};
const item = (id, quantity = 1) => fromKnowledge(foodById(id), quantity);
const DAY_MENUS = [
  { breakfast: [item('idli', 4), item('sambar'), item('boiled-egg-mess', 2)], lunch: [item('rice'), item('dal'), item('mixed-veg'), item('curd')], snack: [item('roasted-chana'), item('tea')], dinner: [item('chapati', 3), item('chole'), item('curd')] },
  { breakfast: [item('upma'), item('banana')], lunch: [item('rice', 1.5), item('sambar'), item('aloo-sabzi'), item('curd')], snack: [item('soya-chunks')], dinner: [item('chapati', 3), item('dal'), item('egg-curry')] },
  { breakfast: [item('poha'), item('milk')], lunch: [item('veg-biryani'), item('curd')], snack: [item('samosa'), item('tea')], dinner: [item('rice'), item('rajma'), item('mixed-veg')] },
];

await connectDb();
const old = await User.findOne({ email: EMAIL });
if (old) {
  await Promise.all([Meal, Plan, Weight, Report, ChatMessage].map((M) => M.deleteMany({ user: old._id })));
  await old.deleteOne();
}

const user = await User.create({
  name: 'Ravi', email: EMAIL, passwordHash: await bcrypt.hash(PASSWORD, 10), profile,
  assessment: await assessProfile(profile, 0),
});

const now = today();
const thisWeek = mondayOf(now);

// Food and weight go in first so the weekly reviews below have real evidence.
const weights = [61.6, 61.7, 61.9, 61.8, 62.1, 62.2, 62.4, 62.3, 62.6, 62.7, 62.9, 62.8, 63.1, 63.2];
await Promise.all(weights.map((weightKg, i) =>
  Weight.create({ user: user._id, date: addDays(now, (i - weights.length + 1) * 2), weightKg })));

for (let back = 27; back >= 1; back -= 1) {
  if (back % 6 === 3) continue;
  const date = addDays(now, -back);
  const menu = DAY_MENUS[back % DAY_MENUS.length];
  await Promise.all(Object.entries(menu).map(([slot, items]) => Meal.create({ user: user._id, date, slot, items })));
}
await Meal.create({ user: user._id, date: now, slot: 'breakfast', items: DAY_MENUS[0].breakfast });
await Meal.create({ user: user._id, date: now, slot: 'lunch', items: DAY_MENUS[0].lunch });

for (const [i, weeksAgo] of [3, 2, 1].entries()) {
  const weekStart = addDays(thisWeek, -7 * weeksAgo);
  const plan = await generatePlan(user, { weekStart });
  plan.sessions.forEach((s, n) => {
    const missed = (i === 0 && n === 3) || (i === 1 && n === 1);
    s.status = missed ? 'skipped' : 'done';
    if (!missed) s.rpe = 7 + (n % 2);
    s.loggedAt = new Date();
  });
  await plan.save();
  await runWeeklyReview(user._id, { weekStart });
}

await generatePlan(user, { weekStart: thisWeek });

const plan = await Plan.findOne({ user: user._id, weekStart: thisWeek });
for (const s of plan.sessions) {
  if (s.day < weekdayIndex(now)) {
    s.status = 'done';
    s.rpe = 7;
    s.loggedAt = new Date();
  }
}
await plan.save();

console.log(`Demo account ready: ${EMAIL} / ${PASSWORD}`);
await disconnectDb();
