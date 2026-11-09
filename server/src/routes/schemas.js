import { z } from 'zod';
import { isDate } from '../lib/dates.js';

export const dateString = z.string().refine(isDate, 'Use a date like 2026-11-04.');

export const credentials = z.object({
  email: z.email().max(200),
  password: z.string().min(8, 'Use at least 8 characters.').max(72),
});
export const registration = credentials.extend({ name: z.string().trim().min(1).max(80) });

const area = z.enum(['knee', 'back', 'shoulder', 'wrist', 'elbow']);
export const profile = z.object({
  age: z.number().int().min(16, 'FitMentor is for people aged 16 and over.').max(80),
  sex: z.enum(['male', 'female', 'other']),
  heightCm: z.number().min(120).max(230),
  weightKg: z.number().min(30).max(250),
  goal: z.enum(['lose_fat', 'maintain', 'build_muscle', 'gain_weight']),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active']),
  experience: z.enum(['beginner', 'intermediate', 'advanced']),
  diet: z.enum(['vegan', 'veg', 'egg', 'nonveg']),
  living: z.enum(['hostel', 'dayscholar']),
  kitchen: z.enum(['none', 'kettle', 'stove']),
  dailyBudget: z.number().min(0).max(2000),
  equipment: z.array(z.enum(['dumbbells', 'bands', 'pullup_bar', 'skipping_rope', 'gym'])).max(5),
  trainingDays: z.array(z.number().int().min(0).max(6)).min(2, 'Pick at least two days.').max(7)
    .refine((days) => new Set(days).size === days.length, 'Each day can only be picked once.'),
  minutesPerSession: z.number().int().min(15).max(120),
  injuries: z.array(area).max(5).default([]),
  scheduleNote: z.string().max(300).default(''),
  foodNote: z.string().max(300).default(''),
});

const macro = (max) => z.number().min(0).max(max);
export const meal = z.object({
  date: dateString,
  slot: z.enum(['breakfast', 'lunch', 'snack', 'dinner']),
  imageToken: z.string().regex(/^[a-f0-9]{32}\.(jpg|png|webp)$/).optional(),
  items: z.array(z.object({
    name: z.string().trim().min(1).max(80),
    foodId: z.string().max(40).optional(),
    quantity: z.number().positive().max(20).default(1),
    serving: z.string().max(80).optional(),
    kcal: macro(5000), protein: macro(400), carbs: macro(800), fat: macro(400),
    priceInr: macro(5000).default(0),
    source: z.enum(['knowledge', 'ai', 'manual']).default('manual'),
    confidence: z.number().min(0).max(1).optional(),
  })).min(1, 'Add at least one food.').max(20),
});

export const sessionLog = z.object({
  status: z.enum(['planned', 'done', 'partial', 'skipped']),
  rpe: z.number().int().min(1).max(10).optional(),
  note: z.string().max(300).optional(),
});

export const planRequest = z.object({
  examWeek: z.boolean().default(false),
  note: z.string().max(300).default(''),
});
export const weightLog = z.object({ weightKg: z.number().min(25).max(300), date: dateString.optional() });
export const chatMessage = z.object({ message: z.string().trim().min(1).max(1000) });
export const notificationPrefs = z.object({ dailyEmail: z.boolean(), hour: z.number().int().min(0).max(23) });
