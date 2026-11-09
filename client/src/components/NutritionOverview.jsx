import { num } from '../lib/api.js';

const R = 72;
const C = 2 * Math.PI * R;
const MACROS = [['protein', 'Protein'], ['carbs', 'Carbs'], ['fat', 'Fat']];
const pct = (a, b) => (b > 0 ? Math.min(100, Math.max(0, (a / b) * 100)) : 0);

export function NutritionOverview({ totals, targets }) {
  const share = targets.kcal > 0 ? Math.min(totals.kcal / targets.kcal, 1) : 0;
  const over = totals.kcal > targets.kcal;
  const left = Math.round(targets.kcal - totals.kcal);
  return (
    <div className="ring-card">
      <div className="ring" role="img" aria-label={`${num(totals.kcal)} of ${num(targets.kcal)} calories eaten`}>
        <svg viewBox="0 0 168 168">
          <circle className="track" cx="84" cy="84" r={R} />
          <circle className={`value ${over ? 'over' : ''}`} cx="84" cy="84" r={R} strokeDasharray={C} strokeDashoffset={C * (1 - share)} />
        </svg>
        <div className="ring-label">
          <strong>{num(Math.abs(left))}</strong>
          <small>{over ? 'kcal over' : 'kcal left'}</small>
        </div>
      </div>
      <div className="macros">
        <div className="macro-row">
          <header><span>Calories</span><strong className="num">{num(totals.kcal)} <small>/ {num(targets.kcal)} kcal</small></strong></header>
          <div className="bar"><i style={{ width: `${pct(totals.kcal, targets.kcal)}%`, background: 'var(--text)' }} /></div>
        </div>
        {MACROS.map(([key, label]) => (
          <div key={key} className={`macro-row macro-${key}`}>
            <header><span><i />{label}</span><strong className="num">{Math.round(totals[key] || 0)} <small>/ {targets[key]} g</small></strong></header>
            <div className="bar"><i style={{ width: `${pct(totals[key] || 0, targets[key])}%` }} /></div>
          </div>
        ))}
        <small>Targets and food values are estimates.</small>
      </div>
    </div>
  );
}
