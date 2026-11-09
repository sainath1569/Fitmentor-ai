import rateLimit from 'express-rate-limit';

const options = { standardHeaders: 'draft-8', legacyHeaders: false, skip: () => process.env.NODE_ENV === 'test' };
const limited = (message) => ({ error: message });

// Only failed attempts count: a whole hostel often shares one IP address.
export const authLimiter = rateLimit({
  ...options, windowMs: 15 * 60 * 1000, limit: 30, skipSuccessfulRequests: true,
  message: limited('Too many attempts. Wait 15 minutes and try again.'),
});

// Keeps one account from using up the free tier of the AI providers.
export const aiLimiter = rateLimit({
  ...options, windowMs: 60 * 1000, limit: 15,
  keyGenerator: (req) => String(req.user._id),
  message: limited('Too many AI requests. Wait a minute and try again.'),
});
