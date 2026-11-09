import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const ownerRef = { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true };

const profileSchema = new Schema({
  age: Number, sex: String, heightCm: Number, weightKg: Number,
  goal: String, activityLevel: String, experience: String,
  diet: String, living: String, kitchen: String,
  dailyBudget: Number,
  equipment: [String], trainingDays: [Number], minutesPerSession: Number,
  injuries: [String], scheduleNote: String, foodNote: String,
}, { _id: false });

const userSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  profile: profileSchema,
  assessment: Schema.Types.Mixed,
  calorieAdjustment: { type: Number, default: 0 },
  notifications: {
    dailyEmail: { type: Boolean, default: true },
    hour: { type: Number, default: 20, min: 0, max: 23 },
    lastSent: String,
  },
}, { timestamps: true });

userSchema.methods.toSafe = function toSafe() {
  const { _id, name, email, profile, assessment, calorieAdjustment, notifications } = this.toObject();
  const { dailyEmail = true, hour = 20 } = notifications ?? {};
  return { id: _id, name, email, profile: profile ?? null, assessment: assessment ?? null, calorieAdjustment, notifications: { dailyEmail, hour } };
};

const mealItem = new Schema({
  name: String, foodId: String, quantity: Number, serving: String,
  kcal: Number, protein: Number, carbs: Number, fat: Number, priceInr: Number,
  source: { type: String, enum: ['knowledge', 'ai', 'manual'] },
  confidence: Number,
}, { _id: false });

const mealSchema = new Schema({
  user: ownerRef,
  date: { type: String, required: true },
  slot: { type: String, enum: ['breakfast', 'lunch', 'snack', 'dinner'], required: true },
  items: [mealItem],
  imageFile: String,
}, { timestamps: true });
mealSchema.index({ user: 1, date: 1 });

const planExercise = new Schema({
  exerciseId: String, name: String, sets: Number, reps: String, restSec: Number, cue: String,
}, { _id: false });

const sessionSchema = new Schema({
  day: { type: Number, min: 0, max: 6 },
  title: String, focus: String, minutes: Number,
  exercises: [planExercise],
  status: { type: String, enum: ['planned', 'done', 'partial', 'skipped'], default: 'planned' },
  rpe: Number, note: String, loggedAt: Date,
});

const planSchema = new Schema({
  user: ownerRef,
  weekStart: { type: String, required: true },
  sessions: [sessionSchema],
  rationale: String,
  adjustment: String,
  level: Number,
  sets: Number,
  examWeek: Boolean,
  generatedBy: String,
  trace: [Schema.Types.Mixed],
}, { timestamps: true });
planSchema.index({ user: 1, weekStart: 1 }, { unique: true });

const weightSchema = new Schema({
  user: ownerRef,
  date: { type: String, required: true },
  weightKg: { type: Number, required: true },
}, { timestamps: true });
weightSchema.index({ user: 1, date: 1 }, { unique: true });

const reportSchema = new Schema({
  user: ownerRef,
  weekStart: { type: String, required: true },
  stats: Schema.Types.Mixed,
  summary: String,
  wins: [String],
  improvements: [String],
  decisions: Schema.Types.Mixed,
  generatedBy: String,
  trace: [Schema.Types.Mixed],
}, { timestamps: true });
reportSchema.index({ user: 1, weekStart: 1 }, { unique: true });

const chatSchema = new Schema({
  user: ownerRef,
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  sources: [String],
  toolsUsed: [String],
  generatedBy: String,
}, { timestamps: true });

export const User = model('User', userSchema);
export const Meal = model('Meal', mealSchema);
export const Plan = model('Plan', planSchema);
export const Weight = model('Weight', weightSchema);
export const Report = model('Report', reportSchema);
export const ChatMessage = model('ChatMessage', chatSchema);
