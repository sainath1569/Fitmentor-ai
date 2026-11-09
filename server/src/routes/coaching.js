import { Router } from 'express';
import { assessProfile } from '../agents/assessor.js';
import { coachReply } from '../agents/coach.js';
import { supportReply } from '../agents/support.js';
import { weekStats } from '../agents/monitor.js';
import { daySummary, suggestFoods, sumItems } from '../agents/nutrition.js';
import { generatePlan, runWeeklyReview } from '../agents/orchestrator.js';
import { addDays, mondayOf, today, weekdayIndex } from '../lib/dates.js';
import { HttpError } from '../lib/errors.js';
import { requireAuth, requireProfile } from '../middleware/auth.js';
import { aiLimiter } from '../middleware/limits.js';
import { buildDigest, sendDigest } from '../mail/dailyDigest.js';
import { ChatMessage, Meal, Plan, Report, Weight } from '../models/index.js';
import { chatMessage, dateString, notificationPrefs, planRequest, sessionLog, weightLog } from './schemas.js';

export const coachingRoutes = Router();
coachingRoutes.use(requireAuth, requireProfile);

coachingRoutes.get('/today', async (req, res) => {
  const date = dateString.parse(req.query.date ?? today());
  const [day, plan] = await Promise.all([
    daySummary(req.user, date),
    Plan.findOne({ user: req.user._id, weekStart: mondayOf(date) }).lean(),
  ]);
  const session = plan?.sessions.find((s) => s.day === weekdayIndex(date)) ?? null;
  const next = plan?.sessions.find((s) => s.day > weekdayIndex(date) && s.status === 'planned') ?? null;
  res.json({
    ...day,
    planId: plan?._id ?? null,
    session,
    nextSession: next,
    suggestions: suggestFoods(req.user.profile, day.remaining, day.budgetLeft),
  });
});

coachingRoutes.get('/plans', async (req, res) => {
  const week = mondayOf(today());
  const [current, next] = await Promise.all([
    Plan.findOne({ user: req.user._id, weekStart: week }).lean(),
    Plan.findOne({ user: req.user._id, weekStart: addDays(week, 7) }).lean(),
  ]);
  res.json({ current, next, todayIndex: weekdayIndex(today()) });
});

coachingRoutes.post('/plans/generate', aiLimiter, async (req, res) => {
  const options = planRequest.parse(req.body ?? {});
  res.json({ plan: await generatePlan(req.user, options) });
});

coachingRoutes.patch('/plans/:planId/sessions/:sessionId', async (req, res) => {
  const update = sessionLog.parse(req.body);
  const plan = await Plan.findOne({ _id: req.params.planId, user: req.user._id });
  const session = plan?.sessions.id(req.params.sessionId);
  if (!session) throw new HttpError(404, 'That session no longer exists.');
  session.status = update.status;
  session.rpe = update.status === 'done' || update.status === 'partial' ? update.rpe : undefined;
  session.note = update.note ?? session.note;
  session.loggedAt = update.status === 'planned' ? undefined : new Date();
  await plan.save();
  res.json({ plan });
});

coachingRoutes.get('/progress', async (req, res) => {
  const end = today();
  const start = addDays(end, -55);
  const [weights, meals, plans] = await Promise.all([
    Weight.find({ user: req.user._id, date: { $gte: start } }).sort({ date: 1 }).lean(),
    Meal.find({ user: req.user._id, date: { $gte: addDays(end, -13) } }).lean(),
    Plan.find({ user: req.user._id, weekStart: { $gte: mondayOf(start) } }).sort({ weekStart: 1 }).lean(),
  ]);
  const byDate = new Map();
  for (const m of meals) byDate.set(m.date, [...(byDate.get(m.date) ?? []), ...m.items]);
  const nutrition = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(end, i - 13);
    const totals = sumItems(byDate.get(date) ?? []);
    return { date, kcal: totals.kcal, protein: totals.protein, logged: byDate.has(date) };
  });
  const stats = await Promise.all(plans.map((p) => weekStats(req.user, p.weekStart)));
  const training = stats
    .filter((s) => s.sessionsDue > 0)
    .map((s) => ({ weekStart: s.weekStart, due: s.sessionsDue, done: s.done, partial: s.partial, adherence: s.adherence, avgRpe: s.avgRpe }));
  res.json({ weights: weights.map(({ date, weightKg }) => ({ date, weightKg })), nutrition, training, week: await weekStats(req.user, mondayOf(end)) });
});

coachingRoutes.post('/progress/weight', async (req, res) => {
  const { weightKg, date = today() } = weightLog.parse(req.body);
  await Weight.findOneAndUpdate({ user: req.user._id, date }, { weightKg }, { upsert: true });
  const latest = await Weight.findOne({ user: req.user._id }).sort({ date: -1 }).lean();
  if (latest.date === date) {
    req.user.profile.weightKg = weightKg;
    req.user.assessment = await assessProfile(req.user.profile.toObject(), req.user.calorieAdjustment);
    await req.user.save();
  }
  res.status(201).json({ date, weightKg });
});

coachingRoutes.get('/progress/weight', async (req, res) => {
  const date = today();
  const list = (await Weight.find({ user: req.user._id, date: { $gte: addDays(date, -89) } }).sort({ date: 1 }).lean())
    .map(({ date: d, weightKg }) => ({ date: d, weightKg }));
  const todays = list.find((w) => w.date === date) ?? null;
  const previous = list.filter((w) => w.date < date).at(-1) ?? null;
  const weekAgo = list.filter((w) => w.date <= addDays(date, -7)).at(-1) ?? null;
  const dates = new Set(list.map((w) => w.date));
  let streak = 0;
  for (let d = todays ? date : addDays(date, -1); dates.has(d); d = addDays(d, -1)) streak += 1;
  const last7 = list.filter((w) => w.date > addDays(date, -7));
  const avg7 = last7.length ? Math.round((last7.reduce((a, w) => a + w.weightKg, 0) / last7.length) * 10) / 10 : null;
  res.json({ date, today: todays, previous, weekAgo, streak, avg7, weights: list, goal: req.user.profile.goal });
});

coachingRoutes.delete('/progress/weight/:date', async (req, res) => {
  await Weight.deleteOne({ user: req.user._id, date: dateString.parse(req.params.date) });
  res.status(204).end();
});

coachingRoutes.put('/notifications', async (req, res) => {
  const { dailyEmail, hour } = notificationPrefs.parse(req.body);
  req.user.set('notifications.dailyEmail', dailyEmail);
  req.user.set('notifications.hour', hour);
  await req.user.save();
  res.json({ user: req.user.toSafe() });
});

coachingRoutes.get('/notifications/preview', async (req, res) => res.json(await buildDigest(req.user)));

coachingRoutes.post('/notifications/send', aiLimiter, async (req, res) => res.json(await sendDigest(req.user)));

coachingRoutes.get('/reports', async (req, res) => {
  const reports = await Report.find({ user: req.user._id }).sort({ weekStart: -1 }).limit(12).lean();
  res.json({ reports });
});

coachingRoutes.post('/reports/weekly', aiLimiter, async (req, res) => {
  const options = planRequest.parse(req.body ?? {});
  res.status(201).json({ report: await runWeeklyReview(req.user._id, options) });
});

coachingRoutes.get('/coach/messages', async (req, res) => {
  const messages = (await ChatMessage.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(40).lean()).reverse();
  res.json({ messages });
});

coachingRoutes.post('/support/messages', aiLimiter, async (req, res) => {
  const raw = Array.isArray(req.body?.messages) ? req.body.messages.slice(-10) : [];
  const history = raw
    .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 1000) }));
  if (history.at(-1)?.role !== 'user') throw new HttpError(400, 'Send a question first.', 'BAD_REQUEST');
  res.json({ reply: await supportReply(history) });
});

coachingRoutes.post('/coach/messages', aiLimiter, async (req, res) => {
  const { message } = chatMessage.parse(req.body);
  res.status(201).json({ reply: await coachReply(req.user, message) });
});
