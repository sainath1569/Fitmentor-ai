import { daySummary, suggestFoods } from '../agents/nutrition.js';
import { config } from '../config.js';
import { today } from '../lib/dates.js';
import { User, Weight } from '../models/index.js';
import { sendMail } from './mailer.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const r = (n) => Math.round(n).toLocaleString('en-IN');

const hourIn = (tz, now = new Date()) =>
  Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(now));

const stat = (label, value, of) => `<td style="padding:14px 16px;background:#f5f6f2;border-radius:12px;vertical-align:top">
<div style="font-size:10px;letter-spacing:.12em;color:#6c756c;text-transform:uppercase">${label}</div>
<div style="font-size:22px;font-weight:700;color:#242d26;margin-top:4px">${value}</div>
<div style="font-size:12px;color:#6c756c">${of}</div></td>`;

const callout = (bg, body) => `<p style="margin:14px 0 0;padding:14px 16px;background:${bg};border-radius:12px;font-size:13px">${body}</p>`;

/** What is still left to reach today, written for one user. */
export async function buildDigest(user, date = today()) {
  const day = await daySummary(user, date);
  const weighed = Boolean(await Weight.exists({ user: user._id, date }));
  const kcalLeft = Math.max(0, day.remaining.kcal);
  const proteinLeft = Math.max(0, day.remaining.protein);
  const first = user.name.split(' ')[0];
  const done = kcalLeft < 100 && proteinLeft < 5;
  const extras = done ? [] : (suggestFoods(user.profile, day.remaining, day.budgetLeft).extras ?? []).slice(0, 3);

  const intro = done
    ? `You reached today's targets, ${first}. Nicely done.`
    : `Here is what's left to reach today, ${first}.`;
  const text = [
    intro,
    ...(done ? [] : [
      `- ${r(kcalLeft)} kcal left of ${r(day.targets.kcal)}`,
      `- ${r(proteinLeft)} g protein left of ${day.targets.protein} g`,
      `- Rs ${r(day.budgetLeft)} left in your food budget`,
    ]),
    ...(day.meals.length ? [] : ['', 'No meals logged yet today. Log what you ate so the numbers are right.']),
    ...(weighed ? [] : ['', "You haven't logged today's weight yet."]),
    ...(extras.length ? ['', 'Easy ways to close the gap:', ...extras.map((x) => `- ${x.name} (${x.serving}): ${x.protein} g protein, Rs ${x.priceInr}`)] : []),
    '', `Open FitMentor: ${config.mail.appUrl}`, '', 'Turn these emails off any time in your profile.',
  ].join('\n');

  const html = `<!doctype html><html><body style="margin:0;background:#eef1ea;font-family:Inter,Segoe UI,Arial,sans-serif;color:#242d26">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:540px;background:#fff;border-radius:18px;overflow:hidden" cellpadding="0" cellspacing="0">
<tr><td style="background:#18211b;padding:22px 28px;color:#e8eee2;font-size:18px;font-weight:700;letter-spacing:-.02em">fitmentor<span style="opacity:.55;font-weight:400">.ai</span></td></tr>
<tr><td style="padding:28px">
<div style="font-size:10px;letter-spacing:.14em;color:#6c756c;text-transform:uppercase">Evening check-in</div>
<h1 style="margin:6px 0 6px;font-size:22px;letter-spacing:-.02em">${done ? 'Targets reached today' : 'What’s left for today'}</h1>
<p style="margin:0 0 18px;color:#6c756c;font-size:14px">${esc(intro)}</p>
${done ? '' : `<table role="presentation" width="100%" cellpadding="0" cellspacing="6" style="border-collapse:separate"><tr>${stat('Calories', r(kcalLeft), `left of ${r(day.targets.kcal)}`)}${stat('Protein', `${r(proteinLeft)} g`, `left of ${day.targets.protein} g`)}${stat('Budget', `₹${r(day.budgetLeft)}`, `left of ₹${r(day.budget)}`)}</tr></table>`}
${day.meals.length ? '' : callout('#fcf0ed', 'No meals logged today. Add them so your numbers are right.')}
${weighed ? '' : callout('#f4fadf', 'You haven’t logged today’s weight yet. It takes ten seconds.')}
${extras.length ? `<h2 style="font-size:15px;margin:24px 0 8px">Easy ways to close the gap</h2><ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.9">${extras.map((x) => `<li><strong>${esc(x.name)}</strong> <span style="color:#6c756c">${esc(x.serving)} · ${x.protein} g protein · ₹${x.priceInr}</span></li>`).join('')}</ul>` : ''}
<p style="margin:26px 0 0"><a href="${esc(config.mail.appUrl)}" style="display:inline-block;background:#d6f48b;color:#202b18;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px;font-size:14px">Open FitMentor</a></p>
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #e1e6dc;font-size:11px;color:#8b9388">Sent once a day at the hour you chose. Turn it off any time in your profile.</td></tr>
</table></td></tr></table></body></html>`;

  return {
    to: user.email,
    subject: done ? 'You reached today’s targets' : `${r(kcalLeft)} kcal and ${r(proteinLeft)} g protein left today`,
    text,
    html,
  };
}

export async function sendDigest(user, date = today()) {
  const message = await buildDigest(user, date);
  const result = await sendMail(message);
  user.set('notifications.lastSent', date);
  await user.save();
  return { to: message.to, subject: message.subject, outbox: Boolean(result?.outbox) };
}

/** Each user gets at most one email per day, once their chosen hour has passed. */
export async function runDueDigests(now = new Date()) {
  const date = today(now);
  const hour = hourIn(config.timeZone, now);
  const users = await User.find({
    'profile.weightKg': { $exists: true },
    'notifications.dailyEmail': { $ne: false },
    'notifications.lastSent': { $ne: date },
  });
  let sent = 0;
  for (const user of users) {
    if ((user.notifications?.hour ?? 20) > hour) continue;
    try {
      await sendDigest(user, date);
      sent += 1;
    } catch (err) {
      console.error(`Daily email to ${user.email} failed:`, err.message);
    }
  }
  return sent;
}

export function startDigestScheduler(everyMs = 5 * 60 * 1000) {
  const tick = () => runDueDigests().catch((err) => console.error('Daily email run failed:', err.message));
  setInterval(tick, everyMs).unref();
  setTimeout(tick, 15000).unref();
}
