import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = dirname(fileURLToPath(import.meta.url));
export const serverRoot = join(here, '..');
dotenv.config({ path: join(serverRoot, '..', '.env'), quiet: true });

const env = process.env;
export const isProd = env.NODE_ENV === 'production';
export const dataDir = env.DATA_DIR || join(serverRoot, '.data');
mkdirSync(dataDir, { recursive: true });

// In development a secret is generated once and kept in .data so sessions survive restarts.
function jwtSecret() {
  if (env.JWT_SECRET) return env.JWT_SECRET;
  if (isProd) throw new Error('JWT_SECRET must be set in production');
  const file = join(dataDir, 'dev-jwt-secret');
  if (!existsSync(file)) writeFileSync(file, randomBytes(48).toString('hex'));
  return readFileSync(file, 'utf8');
}

export const config = {
  port: Number(env.PORT || 5000),
  mongoUri: env.MONGODB_URI || '',
  jwtSecret: jwtSecret(),
  timeZone: env.APP_TIMEZONE || 'Asia/Kolkata',
  uploadDir: env.UPLOAD_DIR || join(serverRoot, 'uploads'),
  llmTimeoutMs: Number(env.LLM_TIMEOUT_MS || 45000),
  mail: {
    host: env.SMTP_HOST || '',
    port: Number(env.SMTP_PORT || 587),
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    from: env.MAIL_FROM || 'FitMentor <no-reply@fitmentor.ai>',
    appUrl: env.APP_URL || 'http://localhost:5173',
  },
  visionProvider: env.VISION_PROVIDER || 'groq',
  groq: {
    name: 'groq',
    apiKey: env.GROQ_API_KEY || '',
    baseUrl: env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    textModel: env.GROQ_MODEL || 'openai/gpt-oss-120b',
    visionModel: env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b',
  },
  gemini: {
    name: 'gemini',
    apiKey: env.GEMINI_API_KEY || '',
    baseUrl: env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai',
    textModel: env.GEMINI_MODEL || 'gemini-3.8-flash',
    visionModel: env.GEMINI_VISION_MODEL || env.GEMINI_MODEL || 'gemini-3.8-flash',
  },
};
