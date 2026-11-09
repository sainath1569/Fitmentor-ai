import { chat, textAvailable } from '../ai/llm.js';

// What the app does, written for the support agent. Keep in step with client/src/pages/Help.jsx.
export const SUPPORT_FAQ = [
  ['targets calorie protein goal', 'Targets come from the goal, body details and activity level in Profile. Change them in Profile and they recalculate.'],
  ['photo estimate accurate log meal food', 'Open Log meal, snap your plate or type what you ate, check each item and portion, then save. Photo values are estimates, so edit any row before saving.'],
  ['mess not recognised type', 'Type it instead, like "2 rotis, dal, rice", then adjust portions on the review screen.'],
  ['budget left money', 'Budget left is your daily food budget from Profile minus the cost of meals logged today.'],
  ['3d video form exercise', 'On Training, every exercise has a form video. Tap play; ones tagged 3D are animated guides showing the muscles working.'],
  ['gym equipment hostel plan', 'Plans use only the equipment you picked in Profile, down to bodyweight moves for a hostel room. Change equipment in Profile and create a new plan on Training.'],
  ['missed skip session', 'Mark the session skipped on Training and carry on. The weekly review adjusts next week.'],
  ['weight jump fluctuate', 'Daily weight moves with water, salt and food. Watch the 7-day average on Today or Progress.'],
  ['email evening summary digest notification', 'Turn the evening summary email on or off in Profile, under notifications.'],
  ['private data delete account', 'Your logs, photos and weight are private to your account.'],
  ['tour demo replay', 'Open Help & FAQ in the sidebar and press Replay demo.'],
  ['password login logout', 'Log out from the bottom of the sidebar. To change details, open Profile.'],
];

const SYSTEM = `You are Spot, the in-app support agent for FitMentor AI, a fitness and nutrition app for students in India.
App map: Today (calories/protein/budget left, meals, weigh-in, today's session), Log meal (photo or text, review then save),
Training (weekly plan, 3D form videos, log sets, skip), Progress (weight trend, weekly reviews), Coach (personal fitness chat),
Help & FAQ (guides, Replay demo), Profile (goal, diet, budget, equipment, schedule, email summary).
Known answers:\n${SUPPORT_FAQ.map(([, a]) => `- ${a}`).join('\n')}
Rules: answer how-to and troubleshooting questions about the app briefly, naming the exact screen to open.
Format: for steps, use a numbered list ("1. ...") with one short action per line; otherwise 1-3 short sentences.
Use **bold** only for screen and button names. No headings, no tables, no parenthetical asides.
For personal diet or training advice, point them to the Coach page. Never invent features. If you can't help, say a human
will follow up and suggest they describe the problem in detail. No medical advice.`;

const fallback = (message) => {
  const words = message.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  let best = null, score = 0;
  for (const [keys, answer] of SUPPORT_FAQ) {
    const s = words.filter((w) => keys.includes(w)).length;
    if (s > score) { best = answer; score = s; }
  }
  return best ?? 'I couldn’t find that in Help. Describe what you were doing and what went wrong, and the team will follow up. For diet or training questions, try the Coach page.';
};

/** history: [{ role: 'user'|'assistant', content }] from the widget, newest last. */
export async function supportReply(history) {
  const last = history.at(-1)?.content ?? '';
  if (!textAvailable()) return { content: fallback(last), source: 'guide' };
  try {
    const { message } = await chat({ temperature: 0.3, messages: [{ role: 'system', content: SYSTEM }, ...history] });
    return { content: message.content?.trim() || fallback(last), source: 'ai' };
  } catch {
    return { content: fallback(last), source: 'guide' };
  }
}
