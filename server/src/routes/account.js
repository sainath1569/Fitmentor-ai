import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { assessProfile } from '../agents/assessor.js';
import { generatePlan } from '../agents/orchestrator.js';
import { HttpError } from '../lib/errors.js';
import { clearSession, requireAuth, setSession } from '../middleware/auth.js';
import { authLimiter } from '../middleware/limits.js';
import { User, Weight } from '../models/index.js';
import { today } from '../lib/dates.js';
import { credentials, profile, registration } from './schemas.js';

export const authRoutes = Router();
// Compared against when the email is unknown, so timing does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

authRoutes.post('/register', authLimiter, async (req, res) => {
  const { name, email, password } = registration.parse(req.body);
  if (await User.exists({ email: email.toLowerCase() })) {
    throw new HttpError(409, 'An account with this email already exists. Log in instead.');
  }
  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 10) });
  setSession(res, user._id);
  res.status(201).json({ user: user.toSafe() });
});

authRoutes.post('/login', authLimiter, async (req, res) => {
  const { email, password } = credentials.parse(req.body);
  const user = await User.findOne({ email: email.toLowerCase() });
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) throw new HttpError(401, 'That email and password do not match.');
  setSession(res, user._id);
  res.json({ user: user.toSafe() });
});

authRoutes.post('/logout', (_req, res) => {
  clearSession(res);
  res.status(204).end();
});

authRoutes.get('/me', requireAuth, (req, res) => res.json({ user: req.user.toSafe() }));

export const profileRoutes = Router();
profileRoutes.use(requireAuth);

profileRoutes.put('/', async (req, res) => {
  const data = profile.parse(req.body);
  const isFirstProfile = !req.user.profile?.weightKg;
  req.user.profile = data;
  req.user.assessment = await assessProfile(data, req.user.calorieAdjustment);
  await req.user.save();
  if (isFirstProfile) {
    await Weight.findOneAndUpdate({ user: req.user._id, date: today() }, { weightKg: data.weightKg }, { upsert: true });
    await generatePlan(req.user);
  }
  res.json({ user: req.user.toSafe() });
});
