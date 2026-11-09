import { useState } from 'react';
import { api, shortDate } from '../lib/api.js';
import { useLoad } from '../lib/useLoad.js';
import { CardHead } from './Bits.jsx';

const LOSING = new Set(['lose_fat']);
const GAINING = new Set(['build_muscle', 'gain_weight']);

function Delta({ label, value, goal }) {
  if (value === null || value === undefined) return <div><span>{label}</span><strong>—</strong></div>;
  const r = Math.round(value * 10) / 10;
  const good = r === 0 ? null : LOSING.has(goal) ? r < 0 : GAINING.has(goal) ? r > 0 : Math.abs(r) <= 0.5;
  return <div className={good === true ? 'good' : good === false ? 'off' : ''}><span>{label}</span><strong>{r > 0 ? '+' : ''}{r.toFixed(1)} kg</strong></div>;
}

function Spark({ weights }) {
  const pts = weights.slice(-14);
  if (pts.length < 2) return null;
  const vals = pts.map((w) => w.weightKg);
  const lo = Math.min(...vals) - 0.2;
  const hi = Math.max(...vals) + 0.2;
  const W = 140; const H = 44;
  const xy = pts.map((w, i) => [(i / (pts.length - 1)) * W, H - ((w.weightKg - lo) / (hi - lo)) * H]);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const [lx, ly] = xy.at(-1);
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Trend over the last ${pts.length} weigh-ins`}>
      <path className="area" d={`${d} L${W} ${H} L0 ${H}Z`} />
      <path className="line" d={d} />
      <circle cx={lx} cy={ly} r="3" />
    </svg>
  );
}

/** Daily weigh-in: one number a day, a streak, and the direction it is heading. */
export function WeightCheckIn({ onSaved }) {
  const { data, reload } = useLoad(() => api.get('/progress/weight'));
  const [value, setValue] = useState('');
  const [editing, setEditing] = useState(false);
  const [state, setState] = useState({ busy: false, error: '' });
  if (!data) return <section className="card"><div className="skeleton lg" /></section>;

  const latest = data.today ?? data.previous;
  const save = async (e) => {
    e.preventDefault();
    setState({ busy: true, error: '' });
    try {
      await api.post('/progress/weight', { weightKg: Number(value) });
      setValue('');
      setEditing(false);
      setState({ busy: false, error: '' });
      reload();
      onSaved?.();
    } catch (err) {
      setState({ busy: false, error: err.message });
    }
  };

  return (
    <section className="card weigh">
      <CardHead title="Daily weigh-in" description={data.today ? 'Logged for today' : 'Not logged today'}>
        {data.streak > 0 && <span className="badge badge-good">{data.streak}-day streak</span>}
      </CardHead>
      <div className="weigh-now">
        <div>
          <strong>{latest ? latest.weightKg.toFixed(1) : '—'}<small>kg</small></strong>
          <p>{data.today ? 'Today' : latest ? `Last logged ${shortDate(latest.date)}` : 'No weigh-ins yet'}</p>
        </div>
        <Spark weights={data.weights} />
      </div>
      <div className="deltas">
        <Delta label="Since last" value={data.today && data.previous ? data.today.weightKg - data.previous.weightKg : null} goal={data.goal} />
        <Delta label="7 days" value={latest && data.weekAgo ? latest.weightKg - data.weekAgo.weightKg : null} goal={data.goal} />
        <div><span>7-day avg</span><strong>{data.avg7 ? `${data.avg7.toFixed(1)} kg` : '—'}</strong></div>
      </div>
      {!data.today || editing ? (
        <form className="inline-form" onSubmit={save}>
          <label className="sr-only" htmlFor="weigh-input">Today’s weight in kg</label>
          <input id="weigh-input" type="number" inputMode="decimal" step="0.1" min="25" max="300" required placeholder={latest ? `${latest.weightKg.toFixed(1)} kg` : 'Weight in kg'} value={value} onChange={(e) => setValue(e.target.value)} />
          <button type="submit" className="btn btn-primary" disabled={state.busy}>{state.busy ? 'Saving…' : data.today ? 'Update' : 'Log weight'}</button>
          {editing && <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>}
        </form>
      ) : (
        <button type="button" className="link" onClick={() => setEditing(true)}>Edit today’s weight</button>
      )}
      {state.error && <p className="notice notice-error" role="alert" style={{ marginTop: 10 }}>{state.error}</p>}
      <p className="weigh-tip">Weigh in at the same time each morning. Daily numbers fluctuate, so track the 7-day average.</p>
    </section>
  );
}
