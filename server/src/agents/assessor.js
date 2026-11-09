import { z } from 'zod';
import { chatJson, textAvailable } from '../ai/llm.js';
import { bmi, calorieFloor, dailyTargets } from '../lib/targets.js';

const GOAL_LABEL = {
  lose_fat: 'lose fat', maintain: 'stay at your weight', build_muscle: 'build muscle', gain_weight: 'gain weight',
};

/** Safety rules are code, not prompts: they apply whether or not an AI key exists. */
export function safetyReview(p) {
  const value = bmi(p);
  const flags = [];
  let effectiveGoal = p.goal;

  if (p.age < 18 && p.goal === 'lose_fat') {
    effectiveGoal = 'maintain';
    flags.push('You are under 18, so your plan keeps calories at maintenance while you are still growing. Talk to a doctor before dieting.');
  }
  if (value < 18.5 && p.goal === 'lose_fat') {
    effectiveGoal = 'gain_weight';
    flags.push('Your BMI is under 18.5, so your plan aims for healthy weight gain instead of fat loss.');
  }
  if (value >= 30) flags.push('Your plan favours joint-friendly exercises. Check with a doctor if you have not trained before.');
  if (p.injuries?.length) flags.push(`Exercises that load these areas are left out: ${p.injuries.join(', ')}.`);
  if (p.dailyBudget < 30) flags.push('Your extra food budget is tight, so suggestions focus on eggs, soya chunks, chana and second helpings at the mess.');
  return { effectiveGoal, flags, bmi: Number(value.toFixed(1)) };
}

function ruleSummary(p, targets, effectiveGoal) {
  const place = p.living === 'hostel' ? 'hostel mess' : 'home and canteen';
  return `Your goal is to ${GOAL_LABEL[effectiveGoal]}. Eat about ${targets.kcal} kcal and ${targets.protein} g of protein a day, mostly from your ${place} food, and train ${p.trainingDays.length} days a week for ${p.minutesPerSession} minutes.`;
}

export async function assessProfile(profile, adjustment = 0) {
  const { effectiveGoal, flags, bmi: bmiValue } = safetyReview(profile);
  const targets = dailyTargets(profile, effectiveGoal, adjustment);
  const base = {
    effectiveGoal, flags, bmi: bmiValue, targets,
    calorieFloor: calorieFloor(profile),
    summary: ruleSummary(profile, targets, effectiveGoal),
    generatedBy: 'rules',
  };
  if (!textAvailable()) return base;

  try {
    const { data, provider } = await chatJson({
      system: 'You are the assessment agent of a student fitness app in India. Write a warm, plain two-sentence summary of what this student should focus on first, given their food access, budget and schedule. Use the given numbers exactly. Never suggest skipping meals. Return {"summary": string}.',
      user: JSON.stringify({ profile, effectiveGoal, targets, flags }),
      schema: z.object({ summary: z.string().min(20).max(600) }),
    });
    return { ...base, summary: data.summary, generatedBy: provider };
  } catch (err) {
    console.warn(`[assessor] using rule summary: ${err.message}`);
    return base;
  }
}
