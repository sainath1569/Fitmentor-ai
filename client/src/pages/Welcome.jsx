import { useRef, useState } from 'react';
import { Notice } from '../components/Bits.jsx';
import { Brand, Icon } from '../components/Icon.jsx';
import { Hero3D } from '../components/Hero3D.jsx';
import { api } from '../lib/api.js';

const FEATURES = [
  { img: '/images/meal.jpg', alt: 'A bowl of rice, chickpeas and greens', title: 'Log meals from a photo', body: 'Snap your plate or type what you ate. Review the calorie and protein estimate, adjust portions, and save in seconds.' },
  { img: '/images/training.jpg', alt: 'An athlete training with a barbell', title: 'Training that fits your space', body: 'Weekly plans built around your schedule and equipment, from a hostel room to a full gym, with a form video for every exercise.' },
];

export function Welcome({ onAuth }) {
  const [mode, setMode] = useState('register');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const auth = useRef(null);
  const isNew = mode === 'register';
  const set = (key) => (e) => setForm((old) => ({ ...old, [key]: e.target.value }));

  const openAuth = (next) => {
    setMode(next);
    setError('');
    auth.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => auth.current?.querySelector('input')?.focus({ preventScroll: true }), 400);
  };
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { user } = await api.post(`/auth/${mode}`, isNew ? form : { email: form.email, password: form.password });
      onAuth(user);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="landing">
      <a className="skip" href="#content">Skip to content</a>
      <header className="l-nav">
        <div className="wrap">
          <a href="#top" aria-label="FitMentor home" style={{ textDecoration: 'none' }}><Brand /></a>
          <nav aria-label="Sections"><a href="#features">Features</a><a href="#how">How it works</a><a href="#start">Get started</a></nav>
          <div className="actions">
            <button type="button" className="btn btn-ghost" onClick={() => openAuth('login')}>Log in</button>
            <button type="button" className="btn btn-primary" onClick={() => openAuth('register')}>Get started</button>
          </div>
        </div>
      </header>

      <main id="content">
        <section className="hero" id="top">
          <div className="wrap">
            <div>
              <span className="pill"><i />AI coach for students in India</span>
              <h1>Stop guessing.<br /><em>Start lifting.</em><br /><span>Nutrition and training, planned around real life.</span></h1>
              <p className="lead">FitMentor sets your calorie and protein targets, reads your meals from a photo, and builds a weekly workout plan for the time and equipment you actually have.</p>
              <div className="cta">
                <button type="button" className="btn btn-primary btn-lg" onClick={() => openAuth('register')}>Create free account <Icon name="arrow" size={16} /></button>
                <a className="btn btn-lg" href="#how">See how it works</a>
              </div>
              <div className="proof">
                <div><strong>44</strong><span>exercises with form videos</span></div>
                <div><strong>3 min</strong><span>to set up your plan</span></div>
                <div><strong>₹0</strong><span>free to use</span></div>
              </div>
            </div>
            <div className="hero-visual"><Hero3D /></div>
          </div>
        </section>

        <div className="ticker" aria-hidden="true">
          <div>{Array.from({ length: 2 }).map((_, k) => <span key={k}>Train hard <b>✦</b> Eat smart <b>✦</b> Log every rep <b>✦</b> Hit your protein <b>✦</b> Sleep. Recover. Repeat <b>✦</b> </span>)}</div>
        </div>

        <div className="logos">
          <div className="wrap">
            <div><Icon name="camera" />Photo meal logging</div>
            <div><Icon name="training" />Weekly training plans</div>
            <div><Icon name="weight" />Daily weigh-ins</div>
            <div><Icon name="mail" />Evening summary email</div>
          </div>
        </div>

        <section className="section" id="features">
          <div className="wrap">
            <div className="section-head">
              <p className="kicker">Features</p>
              <h2>Everything you need to stay consistent.</h2>
              <p>One place for what you eat, how you train and how your body is changing.</p>
            </div>
            <div className="features">
              {FEATURES.map((f) => (
                <article key={f.title} className="feature">
                  <div className="feature-media"><img src={f.img} alt={f.alt} loading="lazy" /></div>
                  <div className="feature-body"><h3>{f.title}</h3><p>{f.body}</p></div>
                </article>
              ))}
              <article className="feature">
                <div className="feature-media feature-ui">
                  <div style={{ width: '100%', display: 'grid' }}>
                    <div className="bubble me">What can I add to my mess dinner for protein?</div>
                    <div className="bubble bot">You have 38 g protein left. Two boiled eggs (₹14) and a glass of milk (₹15) would cover most of it.</div>
                  </div>
                </div>
                <div className="feature-body"><h3>A coach that knows your day</h3><p>Ask about meals, training or your week. Answers use your logs, targets and plan, not generic advice.</p></div>
              </article>
            </div>
          </div>
        </section>

        <section className="section section-alt" id="how">
          <div className="wrap">
            <div className="section-head">
              <p className="kicker">How it works</p>
              <h2>Set up once. Improve every week.</h2>
            </div>
            <div className="steps-grid">
              <article><span className="n">01</span><h3>Tell us about you</h3><p>Goal, diet, budget, schedule and equipment. We calculate your daily targets and build your first plan.</p></article>
              <article><span className="n">02</span><h3>Log as you go</h3><p>Meals by photo or text, workouts with one tap, and a daily weigh-in. An evening email shows what’s left for the day.</p></article>
              <article><span className="n">03</span><h3>Review and adjust</h3><p>A weekly review looks at your data, adjusts calories and sets the next week’s training.</p></article>
            </div>
          </div>
        </section>

        <section className="section join" id="start">
          <div className="wrap">
            <div>
              <div className="section-head" style={{ marginBottom: 0 }}>
                <p className="kicker">Get started</p>
                <h2>Free to use. Ready in three minutes.</h2>
                <p>Create an account and your targets and first training plan are ready as soon as you finish setup.</p>
              </div>
              <ul className="join-points">
                <li><Icon name="check" />Calorie and protein targets for your goal</li>
                <li><Icon name="check" />Meal suggestions within your daily budget</li>
                <li><Icon name="check" />Form videos for every exercise in your plan</li>
                <li><Icon name="check" />Your data stays private to your account</li>
              </ul>
            </div>
            <section className="card auth" ref={auth} aria-label={isNew ? 'Create account' : 'Log in'}>
              <div className="segmented" role="group" aria-label="Account">
                <button type="button" aria-pressed={isNew} disabled={busy} onClick={() => { setMode('register'); setError(''); }}>Sign up</button>
                <button type="button" aria-pressed={!isNew} disabled={busy} onClick={() => { setMode('login'); setError(''); }}>Log in</button>
              </div>
              <h3>{isNew ? 'Create your account' : 'Welcome back'}</h3>
              <p>{isNew ? 'Start with a few details about you.' : 'Log in to continue.'}</p>
              <form onSubmit={submit}>
                {isNew && <label>Name<input value={form.name} onChange={set('name')} autoComplete="name" required maxLength={80} disabled={busy} /></label>}
                <label>Email<input type="email" value={form.email} onChange={set('email')} autoComplete="email" placeholder="you@example.com" required disabled={busy} /></label>
                <label>Password
                  <span className="password">
                    <input aria-label="Password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={set('password')} required minLength={8} autoComplete={isNew ? 'new-password' : 'current-password'} placeholder="At least 8 characters" disabled={busy} />
                    <button type="button" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</button>
                  </span>
                </label>
                {error && <Notice tone="error">{error}</Notice>}
                <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>{busy ? 'Please wait…' : isNew ? 'Create account' : 'Log in'}</button>
              </form>
              <p className="auth-foot"><Icon name="shield" size={14} />Your data is private to your account.</p>
            </section>
          </div>
        </section>
      </main>

      <footer className="l-foot">
        <div className="wrap"><Brand /><span>© {new Date().getFullYear()} FitMentor AI. Estimates are not medical advice.</span></div>
      </footer>
    </div>
  );
}
