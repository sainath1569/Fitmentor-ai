import { addDays, today, weekdayIndex } from '../lib/dates.js';
import { Meal, Plan, Weight } from '../models/index.js';
import { currentTargets, sumItems } from './nutrition.js';

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Everything measurable about one Monday-to-Sunday week. */
export async function weekStats(user, weekStart, asOf = today()) {
  const weekEnd = addDays(weekStart, 6);
  const [plan, meals, weights] = await Promise.all([
    Plan.findOne({ user: user._id, weekStart }).lean(),
    Meal.find({ user: user._id, date: { $gte: weekStart, $lte: weekEnd } }).lean(),
    Weight.find({ user: user._id, date: { $gte: addDays(weekStart, -7), $lte: weekEnd } }).sort({ date: 1 }).lean(),
  ]);

  // An unlogged session only counts against you once its day has passed.
  const lastDay = asOf > weekEnd ? 6 : asOf < weekStart ? -1 : weekdayIndex(asOf) - 1;
  const sessions = plan?.sessions ?? [];
  const due = sessions.filter((s) => s.day <= lastDay || s.status !== 'planned');
  const done = due.filter((s) => s.status === 'done').length;
  const partial = due.filter((s) => s.status === 'partial').length;
  const skipped = due.filter((s) => s.status === 'skipped' || s.status === 'planned').length;
  const rpes = due.map((s) => s.rpe).filter(Boolean);

  const byDay = new Map();
  for (const meal of meals) byDay.set(meal.date, [...(byDay.get(meal.date) ?? []), ...meal.items]);
  const days = [...byDay.values()].map(sumItems);
  const targets = currentTargets(user);

  const inWeek = weights.filter((w) => w.date >= weekStart);
  const before = weights.filter((w) => w.date < weekStart).at(-1);
  const first = before ?? inWeek[0];
  const last = inWeek.at(-1);
  const hasChange = first && last && first.date !== last.date;

  return {
    weekStart, weekEnd,
    sessionsPlanned: sessions.length,
    sessionsDue: due.length,
    done, partial, skipped,
    adherence: due.length ? Number(((done + partial * 0.5) / due.length).toFixed(2)) : null,
    avgRpe: rpes.length ? Number(mean(rpes).toFixed(1)) : null,
    daysLogged: days.length,
    avgKcal: days.length ? Math.round(mean(days.map((d) => d.kcal))) : null,
    avgProtein: days.length ? Math.round(mean(days.map((d) => d.protein))) : null,
    proteinDays: days.filter((d) => d.protein >= targets.protein * 0.9).length,
    kcalDays: days.filter((d) => Math.abs(d.kcal - targets.kcal) <= targets.kcal * 0.1).length,
    extraSpend: days.reduce((sum, d) => sum + d.priceInr, 0),
    weightStart: first?.weightKg ?? null,
    weightEnd: last?.weightKg ?? null,
    weightChange: hasChange ? Number((last.weightKg - first.weightKg).toFixed(1)) : null,
    targets,
  };
}

/** Turns a week of evidence into next week's training and calorie decisions. */
export function decideAdjustments(stats, goal) {
  let training = 'hold';
  let trainingReason = 'Keep the same plan until there is a clearer pattern.';
  if (stats.adherence === null) {
    trainingReason = 'No sessions were due this week, so the plan stays the same.';
  } else if (stats.adherence < 0.5) {
    training = 'reduce';
    trainingReason = `You finished ${Math.round(stats.adherence * 100)}% of sessions, so the plan drops a session to fit your timetable.`;
  } else if (stats.avgRpe !== null && stats.avgRpe >= 9) {
    training = 'deload';
    trainingReason = `Sessions averaged ${stats.avgRpe} out of 10 for effort, so the plan eases off to help you recover.`;
  } else if (stats.adherence >= 0.8) {
    training = 'progress';
    trainingReason = `You finished ${Math.round(stats.adherence * 100)}% of sessions, so the plan steps up.`;
  }

  let kcalChange = 0;
  let kcalReason = 'Calorie target stays the same.';
  if (stats.weightChange === null) {
    kcalReason = 'Log your weight at least twice a week so the calorie target can adapt.';
  } else if (stats.weightStart) {
    const pct = (stats.weightChange / stats.weightStart) * 100;
    const enoughFood = stats.daysLogged >= 4;
    if (goal === 'lose_fat' && pct < -1) {
      kcalChange = 150;
      kcalReason = 'You lost weight faster than 1% this week, so calories go up by 150 to protect muscle.';
    } else if (goal === 'lose_fat' && pct > -0.1 && enoughFood) {
      kcalChange = -100;
      kcalReason = 'Your weight held steady with consistent logging, so calories go down by 100.';
    } else if ((goal === 'build_muscle' || goal === 'gain_weight') && pct < 0.1 && enoughFood) {
      kcalChange = 150;
      kcalReason = 'Your weight did not rise, so calories go up by 150.';
    } else if ((goal === 'build_muscle' || goal === 'gain_weight') && pct > 0.8) {
      kcalChange = -100;
      kcalReason = 'You gained faster than planned, so calories go down by 100.';
    }
  }
  return { training, trainingReason, kcalChange, kcalReason };
}
