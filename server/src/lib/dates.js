import { config } from '../config.js';

// Dates are plain YYYY-MM-DD strings in the app time zone, so a meal logged at
// 11pm in Hyderabad stays on that day wherever the server runs.
export const today = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);

const toUtc = (d) => new Date(`${d}T00:00:00Z`);

export const addDays = (date, n) => {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** 0 = Monday ... 6 = Sunday */
export const weekdayIndex = (date) => (toUtc(date).getUTCDay() + 6) % 7;
export const mondayOf = (date) => addDays(date, -weekdayIndex(date));
export const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toUtc(s).getTime());
export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
