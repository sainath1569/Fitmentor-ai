import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon, LogoMark } from './Icon.jsx';

const KEY = 'fm-demo-done-v1';
export const replayTour = () => window.dispatchEvent(new Event('fm:tour'));

// Small mock previews so each step shows what the feature looks like, not just tells.
const Ring = () => (
  <div className="tv tv-ring"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="32" className="t" /><circle cx="40" cy="40" r="32" className="v" /></svg><b>1,740</b><small>kcal left</small></div>
);
const Snap = () => (
  <div className="tv tv-snap"><div className="tv-plate"><i /></div><ul><li><span>Rice</span><b>210</b></li><li><span>Dal</span><b>140</b></li><li><span>Paneer</span><b>260</b></li></ul></div>
);
const Lift = () => (
  <div className="tv tv-lift"><span className="tv-3d">3D</span><div className="tv-fig"><Icon name="training" size={44} weight="duotone" /></div><div className="tv-sets"><i className="on" /><i className="on" /><i /></div></div>
);
const Trend = () => (
  <div className="tv tv-trend"><svg viewBox="0 0 120 50" preserveAspectRatio="none"><path d="M0 40 L20 34 L40 37 L60 26 L80 28 L100 16 L120 12" /></svg><b>−0.6 kg</b><small>7-day average</small></div>
);
const Chat = () => (
  <div className="tv tv-chat"><p className="me">Protein for mess dinner?</p><p className="bot">2 boiled eggs + milk covers 38 g. ₹29.</p></div>
);

const STEPS = [
  { target: null, icon: 'bolt', kicker: 'Welcome', title: (n) => `Let’s get you moving, ${n}`, body: 'A 30-second tour of everything FitMentor does for you. You can skip any time.' },
  { target: '/', icon: 'home', kicker: 'Today', title: () => 'Your day at a glance', body: 'Calories, protein and budget left, today’s session and your weigh-in in one place.', Visual: Ring },
  { target: '/log', icon: 'camera', kicker: 'Log meal', title: () => 'Snap your plate', body: 'Take a photo or type what you ate. Check the estimate, fix portions, save.', Visual: Snap },
  { target: '/training', icon: 'training', kicker: 'Training', title: () => 'Train with 3D form guides', body: 'A weekly plan for your space and equipment, with 3D animated form videos for each move.', Visual: Lift },
  { target: '/progress', icon: 'chart', kicker: 'Progress', title: () => 'Watch the trend, not the day', body: 'Weight, calories and weekly reviews that adjust your plan as you go.', Visual: Trend },
  { target: '/coach', icon: 'chat', kicker: 'Coach', title: () => 'A coach that knows your day', body: 'Ask about food, training or your week. Answers use your logs and targets.', Visual: Chat },
  { target: '/help', icon: 'help', kicker: 'Help', title: () => 'Stuck? Help is here', body: 'Guides and answers live in Help. You can replay this tour from there too.' },
];

const visible = (sel) => [...document.querySelectorAll(`[data-tour="${sel}"]`)].find((el) => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');

export function Tour({ name }) {
  const [open, setOpen] = useState(() => { try { return !localStorage.getItem(KEY); } catch { return false; } });
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const navigate = useNavigate();
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  const close = useCallback(() => {
    try { localStorage.setItem(KEY, '1'); } catch { /* private mode: tour just shows again */ }
    setOpen(false);
    setI(0);
    navigate('/');
  }, [navigate]);

  useEffect(() => {
    const replay = () => { setI(0); setOpen(true); };
    window.addEventListener('fm:tour', replay);
    return () => window.removeEventListener('fm:tour', replay);
  }, []);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const measure = () => {
      const el = step.target && visible(step.target);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open, step]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') last ? close() : setI((n) => n + 1);
      if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, last, close]);

  if (!open) return null;

  const pad = 6;
  const hole = rect && { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 };
  // Place the card beside the sidebar on desktop, above the tab bar on phones, centered otherwise.
  let pos = { className: 'tour-card tour-center' };
  if (hole) {
    const phone = rect.top > window.innerHeight * 0.6;
    pos = phone
      ? { className: 'tour-card tour-above', style: { bottom: window.innerHeight - hole.top + 14 } }
      : { className: 'tour-card tour-side', style: { left: hole.left + hole.width + 18, top: Math.max(16, Math.min(hole.top - 40, window.innerHeight - 420)) } };
  }
  const { Visual } = step;

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {hole ? <div className="tour-hole" style={hole} /> : <div className="tour-dim" />}
      <div {...pos} key={i}>
        <div className="tour-top">
          <span className="tour-kicker"><Icon name={step.icon} size={14} weight="fill" />{step.kicker}</span>
          <button type="button" className="tour-skip" onClick={close}>Skip</button>
        </div>
        {i === 0 ? <div className="tour-hero"><span className="brand-mark tour-logo"><LogoMark large /></span></div> : Visual && <Visual />}
        <h2 id="tour-title">{step.title(name)}</h2>
        <p>{step.body}</p>
        <div className="tour-foot">
          <div className="tour-dots" aria-label={`Step ${i + 1} of ${STEPS.length}`}>{STEPS.map((s, k) => <i key={s.kicker} className={k === i ? 'on' : k < i ? 'done' : ''} />)}</div>
          <div className="tour-btns">
            {i > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setI(i - 1)}><Icon name="prev" size={14} />Back</button>}
            <button type="button" className="btn btn-primary btn-sm" onClick={() => (last ? close() : setI(i + 1))} autoFocus>
              {i === 0 ? 'Start tour' : last ? 'Let’s go' : 'Next'}<Icon name={last ? 'bolt' : 'next'} size={14} weight="bold" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
