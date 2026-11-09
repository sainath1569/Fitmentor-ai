import { z } from 'zod';
import { chatJson, textAvailable } from '../ai/llm.js';
import { addDays, mondayOf, today } from '../lib/dates.js';
import { Plan, Report, User } from '../models/index.js';
import { assessProfile } from './assessor.js';
import { decideAdjustments, weekStats } from './monitor.js';
import { planWeek } from './planner.js';

const trace = (agent, did, by = 'rules') => ({ agent, did, by });

/** Saves a plan, keeping any session already logged this week. */
async function savePlan(user, weekStart, result, { examWeek, trail }) {
  const existing = await Plan.findOne({ user: user._id, weekStart });
  const logged = (existing?.sessions ?? []).filter((s) => s.status !== 'planned').map((s) => s.toObject());
  const loggedDays = new Set(logged.map((s) => s.day));
  const sessions = [...logged, ...result.sessions.filter((s) => !loggedDays.has(s.day))].sort((a, b) => a.day - b.day);
  return Plan.findOneAndUpdate(
    { user: user._id, weekStart },
    {
      sessions, rationale: result.rationale, adjustment: result.adjustment, level: result.level,
      sets: result.sets, examWeek: Boolean(examWeek), generatedBy: result.generatedBy, trace: trail,
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
}

/** Generates a week of training, adapting from the week before when there is one. */
export async function generatePlan(user, { weekStart = mondayOf(today()), examWeek = false, note = '' } = {}) {
  const trail = [];
  const previous = await Plan.findOne({ user: user._id, weekStart: addDays(weekStart, -7) }).lean();
  let adjustment = 'start';
  let reason = 'Your first week starts with the basics.';

  if (previous) {
    const stats = await weekStats(user, previous.weekStart);
    const decision = decideAdjustments(stats, user.assessment?.effectiveGoal ?? user.profile.goal);
    adjustment = decision.training;
    reason = decision.trainingReason;
    trail.push(trace('Progress monitor', reason));
  } else {
    trail.push(trace('Progress monitor', 'No earlier week to learn from yet.'));
  }

  const result = await planWeek(user.profile, { adjustment, reason, previous, examWeek, note });
  trail.push(trace('Workout planner', `Built ${result.sessions.length} sessions from your equipment and limits.`, result.generatedBy));
  if (result.swaps.applied.length) trail.push(trace('Workout planner', `Made ${result.swaps.applied.length} swaps for your schedule.`, result.generatedBy));
  if (result.swaps.rejected.length) trail.push(trace('Safety check', `Blocked ${result.swaps.rejected.length} swaps that broke your limits.`));
  return savePlan(user, weekStart, result, { examWeek, trail });
}

function ruleReport(stats, decisions) {
  const wins = [];
  const improvements = [];
  if (stats.done) wins.push(`You finished ${stats.done} of ${stats.sessionsDue} due sessions.`);
  if (stats.proteinDays) wins.push(`You reached your protein target on ${stats.proteinDays} days.`);
  if (stats.daysLogged >= 5) wins.push(`You logged food on ${stats.daysLogged} days.`);
  if (stats.skipped) improvements.push(`${stats.skipped} sessions were missed. Move training to a time your timetable protects.`);
  if (stats.daysLogged < 4) improvements.push('Log food on at least four days so your targets can adapt.');
  if (stats.avgProtein !== null && stats.avgProtein < stats.targets.protein * 0.9) {
    improvements.push(`Protein averaged ${stats.avgProtein} g against a target of ${stats.targets.protein} g. Add one cheap protein each day.`);
  }
  if (stats.weightChange === null) improvements.push('Weigh yourself at least twice a week, at the same time of day.');
  if (!wins.length) wins.push('You opened your weekly review, which is where getting back on track starts.');
  const summary = `${decisions.trainingReason} ${decisions.kcalReason}`;
  return { summary, wins, improvements, generatedBy: 'rules' };
}

const reportSchema = z.object({
  summary: z.string().min(20).max(800),
  wins: z.array(z.string().max(220)).min(1).max(4),
  improvements: z.array(z.string().max(220)).max(4),
});

async function writeReport(user, stats, decisions) {
  const fallback = ruleReport(stats, decisions);
  if (!textAvailable()) return fallback;
  try {
    const { data, provider } = await chatJson({
      system: 'You are the report agent of a student fitness app. Write a short weekly report from the given numbers only. Be specific, kind and practical for a student with mess food and a limited budget. Never shame missed sessions and never recommend extreme dieting. Return {"summary": string, "wins": string[], "improvements": string[]}. State the decisions as given and do not change them.',
      user: JSON.stringify({ name: user.name, goal: user.profile.goal, stats, decisions, schedule: user.profile.scheduleNote }),
      schema: reportSchema,
    });
    return { ...data, generatedBy: provider };
  } catch (err) {
    console.warn(`[reporter] using rule report: ${err.message}`);
    return fallback;
  }
}

/**
 * Weekly review pipeline: monitor -> nutrition decision -> planner -> reporter.
 * Running it twice for one week replaces the earlier calorie change, never stacks it.
 */
export async function runWeeklyReview(userId, { weekStart = mondayOf(today()), examWeek = false, note = '' } = {}) {
  const user = await User.findById(userId);
  const trail = [];

  const stats = await weekStats(user, weekStart);
  trail.push(trace('Progress monitor', `Checked ${stats.sessionsDue} due sessions, ${stats.daysLogged} days of food and your weight log.`));

  const goal = user.assessment?.effectiveGoal ?? user.profile.goal;
  const decisions = decideAdjustments(stats, goal);
  trail.push(trace('Nutrition coach', decisions.kcalReason));

  const earlier = await Report.findOne({ user: user._id, weekStart });
  const undo = earlier?.decisions?.kcalChange ?? 0;
  user.calorieAdjustment = (user.calorieAdjustment ?? 0) - undo + decisions.kcalChange;
  user.assessment = await assessProfile(user.profile.toObject(), user.calorieAdjustment);
  await user.save();

  const nextWeek = addDays(weekStart, 7);
  const thisPlan = await Plan.findOne({ user: user._id, weekStart }).lean();
  const planned = await planWeek(user.profile, {
    adjustment: decisions.training, reason: decisions.trainingReason, previous: thisPlan, examWeek, note,
  });
  trail.push(trace('Workout planner', `${decisions.trainingReason} Built ${planned.sessions.length} sessions for next week.`, planned.generatedBy));
  await savePlan(user, nextWeek, planned, { examWeek, trail: [...trail] });

  const written = await writeReport(user, stats, decisions);
  trail.push(trace('Report writer', 'Wrote this summary from the numbers above.', written.generatedBy));

  return Report.findOneAndUpdate(
    { user: user._id, weekStart },
    { stats, decisions: { ...decisions, nextWeek }, trace: trail, ...written },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
}
