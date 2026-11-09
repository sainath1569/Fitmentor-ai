import { useState } from 'react';
import { CardHead, Notice, PageHeading } from '../components/Bits.jsx';
import { EmailSettings } from '../components/EmailSettings.jsx';
import { Brand } from '../components/Icon.jsx';
import { api, DAYS } from '../lib/api.js';

const BLANK = {
  age: '', sex: '', heightCm: '', weightKg: '', goal: '', activityLevel: 'light', experience: 'beginner',
  diet: '', living: 'hostel', kitchen: 'none', dailyBudget: 50, equipment: [], trainingDays: [0, 2, 4],
  minutesPerSession: 30, injuries: [], scheduleNote: '', foodNote: '',
};

function Choice({ legend, value, onChange, options }) {
  return (
    <fieldset className="choices">
      <legend>{legend}</legend>
      <div>
        {options.map(([v, label]) => (
          <label key={v} className={value === v ? 'chip on' : 'chip'}>
            <input type="radio" name={legend} checked={value === v} onChange={() => onChange(v)} />{label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Multi({ legend, hint, values, onChange, options }) {
  const toggle = (v) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  return (
    <fieldset className="choices">
      <legend>{legend}</legend>
      {hint && <span className="hint">{hint}</span>}
      <div>
        {options.map(([v, label]) => (
          <label key={v} className={values.includes(v) ? 'chip on' : 'chip'}>
            <input type="checkbox" checked={values.includes(v)} onChange={() => toggle(v)} />{label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Field({ label, ...props }) {
  return <label>{label}<input inputMode="decimal" required {...props} /></label>;
}

const STEPS = [
  { title: 'About you', ready: (p) => p.age && p.sex && p.heightCm && p.weightKg && p.goal },
  { title: 'Your food', ready: (p) => p.diet },
  { title: 'Your training', ready: (p) => p.trainingDays.length >= 2 },
];

function Sections({ p, set, only }) {
  const show = (i) => only === undefined || only === i;
  const on = (key) => (e) => set(key, e.target.value);
  return (
    <>
      {show(0) && (
        <>
          <div className="field-row">
            <Field label="Age" type="number" min="16" max="80" value={p.age} onChange={on('age')} />
            <Field label="Height (cm)" type="number" min="120" max="230" value={p.heightCm} onChange={on('heightCm')} />
            <Field label="Weight (kg)" type="number" step="0.1" min="30" max="250" value={p.weightKg} onChange={on('weightKg')} />
          </div>
          <Choice legend="Sex, for the calorie estimate" value={p.sex} onChange={(v) => set('sex', v)} options={[['female', 'Female'], ['male', 'Male'], ['other', 'Prefer not to say']]} />
          <Choice legend="What do you want most?" value={p.goal} onChange={(v) => set('goal', v)} options={[['lose_fat', 'Lose fat'], ['build_muscle', 'Build muscle'], ['gain_weight', 'Gain weight'], ['maintain', 'Stay as I am']]} />
          <Choice legend="How active is a normal day?" value={p.activityLevel} onChange={(v) => set('activityLevel', v)} options={[['sedentary', 'Mostly sitting'], ['light', 'Walking to class'], ['moderate', 'On my feet a lot'], ['active', 'Sports most days']]} />
        </>
      )}
      {show(1) && (
        <>
          <Choice legend="Where do you live?" value={p.living} onChange={(v) => set('living', v)} options={[['hostel', 'Hostel'], ['dayscholar', 'At home, day scholar']]} />
          <Choice legend="What do you eat?" value={p.diet} onChange={(v) => set('diet', v)} options={[['veg', 'Vegetarian'], ['egg', 'Vegetarian with eggs'], ['nonveg', 'Non-vegetarian'], ['vegan', 'Vegan']]} />
          <Choice legend="What can you cook with?" value={p.kitchen} onChange={(v) => set('kitchen', v)} options={[['none', 'Nothing'], ['kettle', 'Electric kettle'], ['stove', 'Stove or induction']]} />
          <label>Daily money for food beyond mess or home meals (₹)
            <input type="number" min="0" max="2000" required value={p.dailyBudget} onChange={on('dailyBudget')} />
          </label>
          <label>Food notes <span className="hint">Optional</span>
            <textarea rows="2" maxLength={300} value={p.foodNote} onChange={on('foodNote')} placeholder="Mess serves eggs on Wednesday and Sunday" />
          </label>
        </>
      )}
      {show(2) && (
        <>
          <Choice legend="How much have you trained?" value={p.experience} onChange={(v) => set('experience', v)} options={[['beginner', 'New to it'], ['intermediate', 'Six months or more'], ['advanced', 'Two years or more']]} />
          <Multi legend="What can you use?" hint="Leave empty for a bodyweight plan in your room." values={p.equipment} onChange={(v) => set('equipment', v)} options={[['gym', 'Campus gym'], ['dumbbells', 'Dumbbells'], ['pullup_bar', 'Pull-up bar'], ['bands', 'Resistance bands'], ['skipping_rope', 'Skipping rope']]} />
          <Multi legend="Which days can you train?" values={p.trainingDays} onChange={(v) => set('trainingDays', v)} options={DAYS.map((d, i) => [i, d.slice(0, 3)])} />
          <label>Minutes per session
            <input type="number" min="15" max="120" required value={p.minutesPerSession} onChange={on('minutesPerSession')} />
          </label>
          <Multi legend="Any areas that hurt?" hint="Exercises that load these areas are left out." values={p.injuries} onChange={(v) => set('injuries', v)} options={[['knee', 'Knee'], ['back', 'Lower back'], ['shoulder', 'Shoulder'], ['wrist', 'Wrist'], ['elbow', 'Elbow']]} />
          <label>Schedule notes <span className="hint">Optional</span>
            <textarea rows="2" maxLength={300} value={p.scheduleNote} onChange={on('scheduleNote')} placeholder="Labs until 5pm on Tuesdays" />
          </label>
        </>
      )}
    </>
  );
}

const NUMBERS = ['age', 'heightCm', 'weightKg', 'dailyBudget', 'minutesPerSession'];
const toPayload = (p) => ({ ...p, ...Object.fromEntries(NUMBERS.map((k) => [k, Number(p[k])])) });

const SETUP_COPY = [
  'Used to estimate your calorie and protein targets.',
  'So suggestions match your diet, kitchen and budget.',
  'So your plan fits your days, time and equipment.',
];

export function ProfileSetup({ user, setUser }) {
  const [p, setP] = useState(BLANK);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key, value) => setP((old) => ({ ...old, [key]: value }));
  const last = step === STEPS.length - 1;

  const next = async (e) => {
    e.preventDefault();
    if (!last) return setStep(step + 1);
    setBusy(true);
    setError('');
    try {
      const saved = await api.put('/profile', toPayload(p));
      setUser(saved.user);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
    return undefined;
  };

  return (
    <div className="setup">
      <aside className="setup-aside">
        <div>
          <Brand />
          <div style={{ marginTop: 40 }}>
            <h2>Welcome, {user.name.split(' ')[0]}</h2>
            <p>Three short steps and your targets and first training plan are ready.</p>
          </div>
          <ol className="steps">
            {STEPS.map((s, i) => (
              <li key={s.title} className={i === step ? 'current' : i < step ? 'done' : ''}>
                <span>{i < step ? '✓' : i + 1}</span>{s.title}
              </li>
            ))}
          </ol>
        </div>
        <p className="aside-foot" style={{ fontSize: 12 }}>You can change any of this later in your profile.</p>
      </aside>
      <main className="setup-main">
        <div>
          <header>
            <p className="muted">Step {step + 1} of {STEPS.length}</p>
            <h1>{STEPS[step].title}</h1>
            <p className="muted" style={{ marginTop: 4 }}>{SETUP_COPY[step]}</p>
          </header>
          <form onSubmit={next} className="card form-section">
            <Sections p={p} set={set} only={step} />
            {error && <Notice tone="error">{error}</Notice>}
            <div className="form-actions">
              {step > 0 && <button type="button" className="btn" onClick={() => setStep(step - 1)}>Back</button>}
              <button type="submit" className="btn btn-primary" disabled={busy || !STEPS[step].ready(p)}>
                {busy ? 'Creating your plan…' : last ? 'Finish setup' : 'Continue'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

export function Profile({ user, setUser }) {
  const [p, setP] = useState({ ...BLANK, ...user.profile });
  const [state, setState] = useState({ busy: false, error: '', saved: false });
  const set = (key, value) => { setP((old) => ({ ...old, [key]: value })); setState((s) => ({ ...s, saved: false })); };
  const a = user.assessment;

  const save = async (e) => {
    e.preventDefault();
    setState({ busy: true, error: '', saved: false });
    try {
      const saved = await api.put('/profile', toPayload(p));
      setUser(saved.user);
      setState({ busy: false, error: '', saved: true });
    } catch (err) {
      setState({ busy: false, error: err.message, saved: false });
    }
  };

  return (
    <div className="page page-narrow">
      <PageHeading title="Profile" description="Your details drive your targets, food suggestions and training plan." />
      {a && (
        <section className="card assessment">
          <CardHead title="Your assessment" />
          <p>{a.summary}</p>
          {a.flags.map((flag) => <Notice key={flag}>{flag}</Notice>)}
        </section>
      )}
      <EmailSettings user={user} setUser={setUser} />
      <form onSubmit={save} className="card">
        <div className="form-section"><h2>About you</h2><Sections p={p} set={set} only={0} /></div>
        <div className="form-section"><h2>Food</h2><Sections p={p} set={set} only={1} /></div>
        <div className="form-section"><h2>Training</h2><Sections p={p} set={set} only={2} /></div>
        <div className="card-foot">
          <span>{state.error ? <Notice tone="error">{state.error}</Notice> : state.saved ? <span className="badge badge-good">Saved</span> : <small>New plans use these details.</small>}</span>
          <button type="submit" className="btn btn-primary" disabled={state.busy}>{state.busy ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>
    </div>
  );
}
