import assert from 'node:assert/strict';
import { test } from 'node:test';
import { safetyReview } from '../src/agents/assessor.js';
import { decideAdjustments } from '../src/agents/monitor.js';
import { parseEntry, parseMealText, suggestFoods } from '../src/agents/nutrition.js';
import { allowedExercises, applySwaps, buildPlan } from '../src/agents/planner.js';
import { matchFood, searchKnowledge } from '../src/ai/retriever.js';
import { addDays, mondayOf, weekdayIndex } from '../src/lib/dates.js';
import { bmr, dailyTargets } from '../src/lib/targets.js';
import { exercises } from '../src/knowledge/exercises.js';
import { PROFILE } from './helpers.js';
import { config } from '../src/config.js';

// Rule tests stay deterministic even when local development has AI keys configured.
config.groq.apiKey = '';
config.gemini.apiKey = '';

test('Mifflin-St Jeor matches a worked example', () => {
  assert.equal(bmr({ weightKg: 70, heightCm: 175, age: 20, sex: 'male' }), 1698.75);
});

test('calorie target never drops below the floor', () => {
  const small = { ...PROFILE, sex: 'female', weightKg: 42, heightCm: 150, activityLevel: 'sedentary', goal: 'lose_fat' };
  assert.equal(dailyTargets(small, 'lose_fat', -800).kcal, 1200);
});

test('macros add up to roughly the calorie target', () => {
  const t = dailyTargets(PROFILE);
  assert.ok(Math.abs(t.protein * 4 + t.carbs * 4 + t.fat * 9 - t.kcal) < 15);
});

test('safety rules override unsafe fat loss goals', () => {
  assert.equal(safetyReview({ ...PROFILE, age: 17, goal: 'lose_fat' }).effectiveGoal, 'maintain');
  assert.equal(safetyReview({ ...PROFILE, weightKg: 48, heightCm: 175, goal: 'lose_fat' }).effectiveGoal, 'gain_weight');
});

test('dates: weeks start on Monday', () => {
  assert.equal(mondayOf('2026-11-04'), '2026-11-02');
  assert.equal(weekdayIndex('2026-11-08'), 6);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('food matching handles regional names and refuses partial matches', () => {
  assert.equal(matchFood('pappu').food.id, 'dal');
  assert.equal(matchFood('phulka').food.id, 'chapati');
  assert.equal(matchFood('chicken curry').food.id, 'chicken-curry');
  assert.equal(matchFood('yellow dal').food.id, 'dal');
  assert.equal(matchFood('pizza'), null);
  assert.equal(matchFood('paneer tikka pizza slice'), null);
});

test('typed meals parse quantities and units', async () => {
  assert.deepEqual(parseEntry('2 chapati'), { quantity: 2, label: 'chapati' });
  assert.deepEqual(parseEntry('half cup rice'), { quantity: 0.5, label: 'rice' });
  const { items, unmatched } = await parseMealText('2 roti, 1 katori dal and pizza');
  assert.deepEqual(items.map((i) => [i.foodId, i.quantity]), [['chapati', 2], ['dal', 1]]);
  assert.equal(items[0].kcal, 220);
  assert.deepEqual(unmatched, ['pizza']);
});

test('retrieval surfaces the relevant guide', () => {
  assert.equal(searchKnowledge('how do I train during exams', 1)[0].id, 'exam-week');
  assert.ok(searchKnowledge('cheap protein for veg students', 3).some((h) => h.id === 'cheap-protein' || h.id === 'veg-protein'));
});

test('food suggestions respect diet, budget and kitchen', () => {
  const remaining = { kcal: 900, protein: 40 };
  const veg = suggestFoods({ ...PROFILE, diet: 'veg', kitchen: 'none' }, remaining, 20);
  assert.ok(veg.extras.length > 0);
  for (const x of veg.extras) {
    assert.ok(x.priceInr <= 20);
    assert.notEqual(x.where, 'kettle');
    assert.ok(!['boiled-egg', 'omelette', 'chicken-breast'].includes(x.id));
  }
  assert.equal(suggestFoods(PROFILE, remaining, 60).extras[0].id, 'soya-chunks');
  assert.equal(suggestFoods(PROFILE, { kcal: 20, protein: 2 }, 60).extras.length, 0);
});

test('plans use only owned equipment and skip injured areas', () => {
  const profile = { ...PROFILE, injuries: ['knee'], equipment: ['bands'] };
  const byId = new Map(exercises.map((x) => [x.id, x]));
  const plan = buildPlan(profile);
  assert.equal(plan.sessions.length, 3);
  for (const x of plan.sessions.flatMap((s) => s.exercises)) {
    const known = byId.get(x.exerciseId);
    assert.ok(!known.avoid.includes('knee'), `${x.exerciseId} loads the knee`);
    assert.ok(known.equipment.some((eq) => ['none', 'bands'].includes(eq)), `${x.exerciseId} needs equipment`);
  }
});

test('no exercise repeats within a session and hostel rooms stay quiet', () => {
  const plan = buildPlan({ ...PROFILE, goal: 'lose_fat', experience: 'advanced', trainingDays: [0, 1, 2, 3, 4, 5], minutesPerSession: 60 });
  for (const s of plan.sessions) {
    const ids = s.exercises.map((x) => x.exerciseId);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(!ids.includes('burpee') && !ids.includes('jump-squat'));
  }
});

test('progression adds sets, deload removes them, reduce drops a session', () => {
  const week1 = buildPlan(PROFILE);
  assert.equal(week1.sets, 2);
  const harder = buildPlan(PROFILE, { adjustment: 'progress', previous: week1 });
  assert.equal(harder.sets, 3);
  assert.equal(buildPlan(PROFILE, { adjustment: 'deload', previous: harder }).sets, 2);
  assert.equal(buildPlan(PROFILE, { adjustment: 'reduce', previous: week1 }).sessions.length, 2);
});

test('reduce keeps shrinking from the previous week, down to two sessions', () => {
  const six = { ...PROFILE, trainingDays: [0, 1, 2, 3, 4, 5] };
  const week1 = buildPlan(six);
  const week2 = buildPlan(six, { adjustment: 'reduce', previous: week1 });
  const week3 = buildPlan(six, { adjustment: 'reduce', previous: week2 });
  assert.equal(week2.sessions.length, 5);
  assert.equal(week3.sessions.length, 4);
});

test('exam week is short', () => {
  const plan = buildPlan({ ...PROFILE, trainingDays: [0, 1, 2, 3, 4], minutesPerSession: 60 }, { examWeek: true });
  assert.equal(plan.sessions.length, 3);
  assert.ok(plan.sessions.every((s) => s.minutes <= 25));
});

test('LLM swaps are rejected when they break the rules', () => {
  const profile = { ...PROFILE, injuries: ['knee'] };
  const pool = allowedExercises(profile);
  const plan = buildPlan(profile);
  const session = plan.sessions[0];
  const push = session.exercises.find((x) => exercises.find((e) => e.id === x.exerciseId).pattern === 'push');
  const before = JSON.stringify(plan);
  const { applied, rejected } = applySwaps(plan, [
    { day: session.day, removeId: push.exerciseId, addId: 'barbell-squat' },
    { day: session.day, removeId: push.exerciseId, addId: 'made-up-exercise' },
    { day: session.day, removeId: push.exerciseId, addId: 'glute-bridge' },
  ], pool);
  assert.equal(applied.length, 0);
  assert.equal(rejected.length, 3);
  assert.equal(JSON.stringify(plan), before);
});

test('weekly decisions follow the evidence', () => {
  const base = { adherence: 0.9, avgRpe: 7, weightChange: null, weightStart: null, daysLogged: 5 };
  assert.equal(decideAdjustments(base, 'maintain').training, 'progress');
  assert.equal(decideAdjustments({ ...base, adherence: 0.3 }, 'maintain').training, 'reduce');
  assert.equal(decideAdjustments({ ...base, avgRpe: 9.5 }, 'maintain').training, 'deload');
  assert.equal(decideAdjustments({ ...base, adherence: 0.6 }, 'maintain').training, 'hold');
  assert.equal(decideAdjustments({ ...base, adherence: null }, 'maintain').training, 'hold');
  const fast = { ...base, weightStart: 70, weightChange: -1.2 };
  assert.equal(decideAdjustments(fast, 'lose_fat').kcalChange, 150);
  const stuck = { ...base, weightStart: 70, weightChange: 0 };
  assert.equal(decideAdjustments(stuck, 'lose_fat').kcalChange, -100);
  assert.equal(decideAdjustments(stuck, 'gain_weight').kcalChange, 150);
  assert.equal(decideAdjustments({ ...stuck, daysLogged: 2 }, 'lose_fat').kcalChange, 0);
});
