import { existsSync } from 'node:fs';
import { join } from 'node:path';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import multer from 'multer';
import { ZodError } from 'zod';
import { aiStatus } from './ai/llm.js';
import { serverRoot } from './config.js';
import { HttpError } from './lib/errors.js';
import { authRoutes, profileRoutes } from './routes/account.js';
import { coachingRoutes } from './routes/coaching.js';
import { mealRoutes } from './routes/meals.js';

export function createApp() {
  const app = express();
  app.use(helmet({ contentSecurityPolicy: { directives: {
    imgSrc: ["'self'", 'data:', 'blob:', 'https://i.ytimg.com'],
    frameSrc: ['https://www.youtube-nocookie.com'],
  } } }));
  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());

  app.get('/api/status', (_req, res) => res.json({ ok: true, ai: aiStatus() }));
  app.use('/api/auth', authRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/meals', mealRoutes);
  app.use('/api', coachingRoutes);
  app.use('/api', (_req, _res) => { throw new HttpError(404, 'Not found.'); });

  const dist = join(serverRoot, '..', 'client', 'dist');
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(join(dist, 'index.html')));
  }

  app.use((err, _req, res, _next) => {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: err.issues[0]?.message ?? 'Check your entries.', fields: err.issues.map((i) => i.path.join('.')) });
    }
    if (err instanceof multer.MulterError) {
      return res.status(413).json({ error: 'Use a photo under 6 MB.' });
    }
    if (err instanceof mongoose.Error.CastError) return res.status(404).json({ error: 'Not found.' });
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, code: err.code });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request was not valid JSON.' });
    console.error(err);
    return res.status(500).json({ error: 'Something went wrong on the server. Try again.' });
  });
  return app;
}
