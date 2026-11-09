import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { analyzeMealImage, daySummary, parseMealText, suggestFoods, sumItems, swapsFor } from '../agents/nutrition.js';
import { searchFoods } from '../ai/retriever.js';
import { config } from '../config.js';
import { today } from '../lib/dates.js';
import { HttpError } from '../lib/errors.js';
import { requireAuth, requireProfile } from '../middleware/auth.js';
import { aiLimiter } from '../middleware/limits.js';
import { Meal } from '../models/index.js';
import { dateString, meal as mealSchema } from './schemas.js';

export const mealRoutes = Router();
mealRoutes.use(requireAuth, requireProfile);
mkdirSync(config.uploadDir, { recursive: true });

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 6 * 1024 * 1024, files: 1 } });

/** Checks the file's real bytes rather than trusting its name or declared type. */
export function sniffImage(buffer) {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', mime: 'image/png' };
  if (buffer.length > 12 && buffer.toString('latin1', 0, 4) === 'RIFF' && buffer.toString('latin1', 8, 12) === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  return null;
}

const dateFrom = (req) => dateString.parse(req.query.date ?? today());

async function withAdvice(user, date, items) {
  const day = await daySummary(user, date);
  const added = sumItems(items);
  const remaining = { kcal: day.remaining.kcal - added.kcal, protein: day.remaining.protein - added.protein };
  const budgetLeft = Math.max(0, day.budgetLeft - added.priceInr);
  return { totals: added, swaps: swapsFor(items, user.profile), suggestions: suggestFoods(user.profile, remaining, budgetLeft) };
}

mealRoutes.post('/analyze', aiLimiter, upload.single('image'), async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Choose a photo of your meal.');
  const type = sniffImage(req.file.buffer);
  if (!type) throw new HttpError(415, 'Use a JPG, PNG or WebP photo.');

  const result = await analyzeMealImage(req.file.buffer, type.mime);
  if (!result.isFood || !result.items.length) {
    throw new HttpError(422, 'No food was found in this photo. Try a clearer photo from above, or type the meal.');
  }
  const imageToken = `${randomBytes(16).toString('hex')}.${type.ext}`;
  await writeFile(join(config.uploadDir, imageToken), req.file.buffer);
  res.json({ items: result.items, imageToken, provider: result.provider, ...(await withAdvice(req.user, dateFrom(req), result.items)) });
});

mealRoutes.post('/parse', async (req, res) => {
  const { text } = z.object({ text: z.string().trim().min(1).max(500) }).parse(req.body);
  const parsed = await parseMealText(text);
  res.json({ ...parsed, ...(await withAdvice(req.user, dateFrom(req), parsed.items)) });
});

mealRoutes.get('/foods', (req, res) => res.json({ foods: searchFoods(String(req.query.q ?? '')) }));

mealRoutes.get('/suggestions', async (req, res) => {
  const day = await daySummary(req.user, dateFrom(req));
  res.json(suggestFoods(req.user.profile, day.remaining, day.budgetLeft));
});

mealRoutes.get('/', async (req, res) => res.json(await daySummary(req.user, dateFrom(req))));

mealRoutes.post('/', async (req, res) => {
  const { imageToken, ...data } = mealSchema.parse(req.body);
  const imageFile = imageToken && existsSync(join(config.uploadDir, imageToken)) ? imageToken : undefined;
  const created = await Meal.create({ ...data, user: req.user._id, imageFile });
  res.status(201).json({ meal: created });
});

mealRoutes.delete('/:id', async (req, res) => {
  const removed = await Meal.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!removed) throw new HttpError(404, 'That meal no longer exists.');
  if (removed.imageFile) await unlink(join(config.uploadDir, removed.imageFile)).catch(() => {});
  res.status(204).end();
});

mealRoutes.get('/:id/image', async (req, res) => {
  const found = await Meal.findOne({ _id: req.params.id, user: req.user._id }).lean();
  if (!found?.imageFile) throw new HttpError(404, 'This meal has no photo.');
  res.sendFile(found.imageFile, { root: config.uploadDir });
});
