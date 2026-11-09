import { z } from 'zod';
import { chatJson, textAvailable } from '../ai/llm.js';
import { searchKnowledge } from '../ai/retriever.js';
import { exercises } from '../knowledge/exercises.js';
import { DAY_NAMES } from '../lib/dates.js';

const LEVEL = { beginner: 1, intermediate: 2, advanced: 3 };
const LOUD_IN_HOSTEL = new Set(['jump-squat', 'burpee']);
const TEMPLATES = {
  full: { title: 'Full body', slots: ['squat', 'push', 'pull', 'hinge', 'core', 'push', 'pull'] },
  upper: { title: 'Upper body', slots: ['push', 'pull', 'push', 'pull', 'core', 'push', 'pull'] },
  lower: { title: 'Legs and core', slots: ['squat', 'hinge', 'core', 'squat', 'hinge', 'core', 'cardio'] },
};
const ROTATION = {
  4: ['upper', 'lower', 'upper', 'lower'],
  5: ['upper', 'lower', 'full', 'upper', 'lower'],
  6: ['upper', 'lower', 'full', 'upper', 'lower', 'full'],
  7: ['upper', 'lower', 'full', 'upper', 'lower', 'full', 'lower'],
};

/** The only exercises this student can safely do with what they have. */
export function allowedExercises(profile) {
  const owned = new Set(['none', ...(profile.equipment ?? [])]);
  const injuries = new Set(profile.injuries ?? []);
  return exercises.filter((x) =>
    x.equipment.some((eq) => owned.has(eq))
    && !x.avoid.some((area) => injuries.has(area))
    && !(profile.living === 'hostel' && LOUD_IN_HOSTEL.has(x.id)));
}

function pick(pool, pattern, level, used) {
  const options = pool.filter((x) => x.pattern === pattern);
  if (!options.length) return null;
  const rank = (x) => [
    used.has(x.id) ? 1 : 0,
    x.level > level ? 1 : 0,
    Math.abs(level - x.level),
    x.equipment.includes('none') ? 1 : 0,
  ];
  return [...options].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    for (let i = 0; i < ra.length; i += 1) if (ra[i] !== rb[i]) return ra[i] - rb[i];
    return 0;
  })[0];
}

const restFor = (x) => (x.pattern === 'core' || x.pattern === 'cardio' ? 45 : 90);
const asPlanned = (x, sets) => ({
  exerciseId: x.id, name: x.name, sets: x.pattern === 'cardio' ? 1 : sets, reps: x.reps, restSec: restFor(x), cue: x.cue,
});

/** Spreads n sessions across the student's chosen days. */
function chooseDays(days, n) {
  const sorted = [...days].sort((a, b) => a - b);
  if (n >= sorted.length) return sorted;
  return Array.from({ length: n }, (_, i) => sorted[Math.floor((i * sorted.length) / n)]);
}

/** Deterministic plan. It is always valid and is the base the LLM may refine. */
export function buildPlan(profile, { adjustment = 'start', previous = null, examWeek = false } = {}) {
  const pool = allowedExercises(profile);
  let level = previous?.level ?? LEVEL[profile.experience] ?? 1;
  let sets = previous?.sets ?? (profile.experience === 'beginner' ? 2 : 3);
  let dayCount = profile.trainingDays.length;
  let minutes = profile.minutesPerSession;

  if (adjustment === 'progress') {
    if (sets < 4) sets += 1;
    else level = Math.min(level + 1, 3);
  }
  if (adjustment === 'deload') sets = Math.max(sets - 1, 2);
  if (adjustment === 'reduce') dayCount = Math.max(previous?.sessions?.length ? previous.sessions.length - 1 : dayCount - 1, 2);
  if (examWeek) {
    dayCount = Math.min(dayCount, 3);
    minutes = Math.min(minutes, 25);
    sets = 2;
  }
  dayCount = Math.min(dayCount, profile.trainingDays.length);

  const days = chooseDays(profile.trainingDays, dayCount);
  const rotation = ROTATION[days.length] ?? days.map(() => 'full');
  const perSession = Math.min(7, Math.max(3, Math.floor((minutes - 4) / (sets * 2 + 1))));
  const used = new Set();

  const sessions = days.map((day, i) => {
    const template = TEMPLATES[rotation[i]];
    const chosen = [];
    for (const pattern of template.slots) {
      if (chosen.length >= perSession) break;
      const exercise = pick(pool, pattern, level, used);
      if (exercise && !chosen.some((c) => c.id === exercise.id)) {
        chosen.push(exercise);
        used.add(exercise.id);
      }
    }
    if (profile.goal === 'lose_fat' && chosen.length && chosen.at(-1).pattern !== 'cardio') {
      const finisher = pick(pool, 'cardio', level, used);
      if (finisher) {
        chosen[chosen.length - 1] = finisher;
        used.add(finisher.id);
      }
    }
    return { day, title: template.title, focus: rotation[i], minutes, exercises: chosen.map((x) => asPlanned(x, sets)) };
  });
  return { sessions, level, sets, adjustment };
}

const refinementSchema = z.object({
  rationale: z.string().min(20).max(700),
  swaps: z.array(z.object({ day: z.coerce.number(), removeId: z.string(), addId: z.string(), reason: z.string().max(200).optional() })).max(6).default([]),
});

/** Applies only swaps that keep the movement pattern and stay inside the allowed pool. */
export function applySwaps(plan, swaps, pool) {
  const byId = new Map(pool.map((x) => [x.id, x]));
  const applied = [];
  const rejected = [];
  for (const swap of swaps) {
    const session = plan.sessions.find((s) => s.day === swap.day);
    const index = session?.exercises.findIndex((x) => x.exerciseId === swap.removeId) ?? -1;
    const replacement = byId.get(swap.addId);
    const current = byId.get(swap.removeId);
    const duplicate = session?.exercises.some((x) => x.exerciseId === swap.addId);
    if (index < 0 || !replacement || !current || duplicate || replacement.pattern !== current.pattern) {
      rejected.push(swap);
      continue;
    }
    session.exercises[index] = asPlanned(replacement, session.exercises[index].sets);
    applied.push(swap);
  }
  return { applied, rejected };
}

const ruleRationale = (profile, plan, reason, examWeek) => {
  const place = (profile.equipment ?? []).includes('gym') ? 'the campus gym' : 'your room';
  const lead = examWeek ? 'This is a short exam-week plan to keep the habit going.' : reason;
  return `${lead} ${plan.sessions.length} sessions of about ${plan.sessions[0]?.minutes ?? profile.minutesPerSession} minutes, set up for ${place}.`;
};

/** Planner agent: builds the safe plan, then lets the LLM suggest validated swaps. */
export async function planWeek(profile, { adjustment, reason, previous, examWeek, note }) {
  const plan = buildPlan(profile, { adjustment, previous, examWeek });
  const pool = allowedExercises(profile);
  const fallback = {
    ...plan,
    rationale: ruleRationale(profile, plan, reason ?? 'Your first week starts with the basics.', examWeek),
    generatedBy: 'rules',
    swaps: { applied: [], rejected: [] },
  };
  if (!textAvailable()) return fallback;

  try {
    const context = searchKnowledge(`${note ?? ''} ${profile.scheduleNote ?? ''} ${examWeek ? 'exam' : 'progress'} training`, 3);
    const { data, provider } = await chatJson({
      system: `You are the workout planning agent of a student fitness app. A safe plan is given. Explain it to the student in 2 or 3 plain sentences that mention their situation, and propose swaps only if they serve the student's note or schedule.
Return {"rationale": string, "swaps": [{"day": number, "removeId": string, "addId": string, "reason": string}]}.
addId must come from allowedExercises and have the same pattern as removeId. Days are 0 for Monday to 6 for Sunday.`,
      user: JSON.stringify({
        student: {
          goal: profile.goal, experience: profile.experience, living: profile.living,
          equipment: profile.equipment, injuries: profile.injuries, scheduleNote: profile.scheduleNote,
        },
        weekNote: note ?? '',
        examWeek: Boolean(examWeek),
        adjustment, adjustmentReason: reason,
        plan: plan.sessions.map((s) => ({ day: DAY_NAMES[s.day], dayIndex: s.day, title: s.title, exercises: s.exercises.map((x) => x.exerciseId) })),
        allowedExercises: pool.map((x) => ({ id: x.id, pattern: x.pattern, level: x.level })),
        guidance: context.map((c) => c.text),
      }),
      schema: refinementSchema,
    });
    const swaps = applySwaps(plan, data.swaps, pool);
    return { ...plan, rationale: data.rationale, generatedBy: provider, swaps };
  } catch (err) {
    console.warn(`[planner] using rule plan: ${err.message}`);
    return fallback;
  }
}
