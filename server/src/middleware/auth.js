import jwt from 'jsonwebtoken';
import { config, isProd } from '../config.js';
import { HttpError } from '../lib/errors.js';
import { User } from '../models/index.js';

const COOKIE = 'fm_session';
const WEEK_MS = 7 * 24 * 3600 * 1000;

export function setSession(res, userId) {
  const token = jwt.sign({ sub: String(userId) }, config.jwtSecret, { expiresIn: '7d' });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: isProd, maxAge: WEEK_MS });
}

export const clearSession = (res) => res.clearCookie(COOKIE);

export async function requireAuth(req, _res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) throw new HttpError(401, 'Log in to continue.');
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new HttpError(401, 'Your session has ended. Log in again.');
  }
  const user = await User.findById(payload.sub);
  if (!user) throw new HttpError(401, 'Log in to continue.');
  req.user = user;
  next();
}

export function requireProfile(req, _res, next) {
  if (!req.user.profile?.weightKg) {
    throw new HttpError(409, 'Finish your profile first.', 'PROFILE_REQUIRED');
  }
  next();
}
