const ACTIVITY = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
const GOAL_KCAL = { lose_fat: -400, maintain: 0, build_muscle: 250, gain_weight: 350 };
const PROTEIN_PER_KG = { lose_fat: 1.8, maintain: 1.2, build_muscle: 1.8, gain_weight: 1.6 };

export const bmi = ({ weightKg, heightCm }) => weightKg / (heightCm / 100) ** 2;

/** Mifflin-St Jeor resting energy. "other" uses the midpoint of the two sex constants. */
export function bmr({ weightKg, heightCm, age, sex }) {
  const offset = sex === 'male' ? 5 : sex === 'female' ? -161 : -78;
  return 10 * weightKg + 6.25 * heightCm - 5 * age + offset;
}

export const tdee = (p) => bmr(p) * (ACTIVITY[p.activityLevel] ?? 1.375);

export const calorieFloor = (p) => (p.sex === 'male' ? 1500 : p.sex === 'female' ? 1200 : 1350);

/** Daily targets. `adjustment` is the running correction made by the weekly review. */
export function dailyTargets(p, effectiveGoal = p.goal, adjustment = 0) {
  const maintenance = tdee(p);
  const raw = maintenance + (GOAL_KCAL[effectiveGoal] ?? 0) + adjustment;
  const kcal = Math.round(Math.max(raw, calorieFloor(p)) / 10) * 10;
  const protein = Math.round(p.weightKg * (PROTEIN_PER_KG[effectiveGoal] ?? 1.2));
  const fat = Math.round((kcal * 0.25) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, carbs, fat, maintenance: Math.round(maintenance) };
}
