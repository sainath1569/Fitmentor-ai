import { useState } from 'react';
import { AgentTrace, CardHead, EmptyState, Loading, Notice, PageError, PageHeading } from '../components/Bits.jsx';
import { ExerciseMedia, exerciseMedia } from '../components/ExerciseMedia.jsx';
import { Icon } from '../components/Icon.jsx';
import { api, DAYS, shortDate } from '../lib/api.js';
import { useLoad } from '../lib/useLoad.js';

const STATUS = { done: 'Completed', partial: 'Partly done', skipped: 'Skipped', planned: 'Planned' };
const BADGE = { done: 'badge-good', partial: 'badge-warn', skipped: 'badge-muted', planned: 'badge-muted' };

function Exercise({ x, index }) {
  const [playing, setPlaying] = useState(false);
  const { video, searchUrl } = exerciseMedia(x.exerciseId, x.name);
  return (
    <li className={`exercise ${playing ? 'playing' : ''}`}>
      <ExerciseMedia id={x.exerciseId} name={x.name} playing={playing} onPlay={() => setPlaying(true)} />
      <div>
        <small>Exercise {index + 1}</small>
        <h3>{x.name}</h3>
        <div className="dose">
          <span className="badge">{x.sets > 1 ? `${x.sets} × ${x.reps}` : x.reps}</span>
          {x.sets > 1 && <span className="badge badge-muted">Rest {x.restSec}s</span>}
        </div>
        <p className="cue">{x.cue}</p>
        <div className="refs">
          {video && !playing && <button type="button" className="link" onClick={() => setPlaying(true)}>Watch form video</button>}
          {playing && <button type="button" className="link link-muted" onClick={() => setPlaying(false)}>Close video</button>}
          <a className="link link-muted" href={video ? `https://www.youtube.com/watch?v=${video.youtubeId}` : searchUrl} target="_blank" rel="noreferrer">
            {video ? 'Open on YouTube' : 'Find videos'} <Icon name="external" size={12} />
          </a>
        </div>
        {video && <small style={{ display: 'block', marginTop: 6 }}>{video.channel}</small>}
      </div>
    </li>
  );
}

function SessionLog({ session, onLog, busy }) {
  const [rpe, setRpe] = useState(session.rpe ?? 7);
  if (session.status !== 'planned') {
    return (
      <div className="card-foot">
        <span><span className={`badge ${BADGE[session.status]}`}>{STATUS[session.status]}</span>{session.rpe ? <small style={{ marginLeft: 8 }}>Effort {session.rpe}/10</small> : null}</span>
        <button type="button" className="link link-muted" disabled={busy} onClick={() => onLog({ status: 'planned' })}>Undo</button>
      </div>
    );
  }
  return (
    <div className="card-foot log-panel" style={{ display: 'grid' }}>
      <div className="rpe">
        <header><span>How hard was it?</span><span className="num">{rpe}/10</span></header>
        <input type="range" min="1" max="10" value={rpe} onChange={(e) => setRpe(Number(e.target.value))} aria-label="Effort from 1 to 10" />
        <div className="rpe-scale"><span>Easy</span><span>Moderate</span><span>Max effort</span></div>
      </div>
      <div className="btn-row">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onLog({ status: 'done', rpe })}><Icon name="check" size={16} /> Mark complete</button>
        <button type="button" className="btn" disabled={busy} onClick={() => onLog({ status: 'partial', rpe })}>Partly done</button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => onLog({ status: 'skipped' })}>Skip</button>
      </div>
    </div>
  );
}

function Rebuild({ onDone, initial = false }) {
  const [examWeek, setExamWeek] = useState(false);
  const [note, setNote] = useState('');
  const [state, setState] = useState({ busy: false, error: '' });
  const rebuild = async (e) => {
    e.preventDefault();
    setState({ busy: true, error: '' });
    try {
      await api.post('/plans/generate', { examWeek, note });
      setState({ busy: false, error: '' });
      setNote('');
      onDone();
    } catch (err) {
      setState({ busy: false, error: err.message });
    }
  };
  return (
    <form className="card stack" onSubmit={rebuild}>
      <CardHead title={initial ? 'Create your plan' : 'Adjust this week'} description={initial ? 'Built from your profile: goal, equipment, days and time.' : 'Busy week or a change in routine? Rebuild the remaining sessions.'} />
      <label className="check"><input type="checkbox" checked={examWeek} onChange={(e) => setExamWeek(e.target.checked)} /> Exam week (shorter sessions)</label>
      <label>What changed? <span className="hint">Optional</span>
        <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Gym closed until Friday" />
      </label>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <button type="submit" className="btn btn-primary" disabled={state.busy}>{state.busy ? 'Building…' : initial ? 'Create plan' : 'Rebuild week'}</button>
      {!initial && <small>Sessions you’ve already logged are kept.</small>}
    </form>
  );
}

function Week({ plan, todayIndex, selected, onSelect }) {
  return (
    <div className="week" role="group" aria-label="Days this week">
      {DAYS.map((d, i) => {
        const s = plan.sessions.find((x) => x.day === i);
        return (
          <button key={d} type="button" disabled={!s} aria-pressed={selected === i}
            className={`day ${s ? s.status : ''} ${i === todayIndex ? 'today' : ''}`} onClick={() => onSelect(i)}>
            <span className="d">{d.slice(0, 3)}{i === todayIndex ? ' · Today' : ''}</span>
            <span className="t">{s ? s.title : 'Rest'}</span>
            {s && <span className="dot" aria-label={STATUS[s.status]} />}
          </button>
        );
      })}
    </div>
  );
}

export function Training() {
  const { data, error, loading, reload } = useLoad(() => api.get('/plans'));
  const [day, setDay] = useState(null);
  const [busy, setBusy] = useState(false);
  const [logError, setLogError] = useState('');

  if (loading) return <Loading what="your plan" />;
  if (!data) return <PageError error={error} onRetry={reload} />;
  const { current, next, todayIndex } = data;

  if (!current) {
    return (
      <div className="page">
        <PageHeading title="Training" description="A weekly plan built around your time, space and equipment." />
        <div className="grid-main">
          <section className="card"><EmptyState icon="training" title="No plan for this week yet">Create a plan and you’ll get sessions for each training day, with form videos for every exercise.</EmptyState></section>
          <Rebuild initial onDone={reload} />
        </div>
      </div>
    );
  }

  const done = current.sessions.filter((s) => s.status === 'done' || s.status === 'partial').length;
  const fallback = current.sessions.find((s) => s.day === todayIndex) ?? current.sessions.find((s) => s.day > todayIndex) ?? current.sessions[0];
  const session = current.sessions.find((s) => s.day === day) ?? fallback;

  const log = async (body) => {
    setBusy(true);
    setLogError('');
    try {
      await api.patch(`/plans/${current._id}/sessions/${session._id}`, body);
      await reload();
    } catch (err) {
      setLogError(err.message);
    }
    setBusy(false);
  };

  return (
    <div className="page">
      <PageHeading overline={`Week of ${shortDate(current.weekStart)}`} title="Training" description={`${done} of ${current.sessions.length} sessions completed this week.`} />
      <Week plan={current} todayIndex={todayIndex} selected={session?.day} onSelect={setDay} />
      <div className="grid-main">
        <div className="stack">
          {session && (
            <section className="card">
              <CardHead title={session.title} description={`${DAYS[session.day]} · ${session.minutes} min · ${session.exercises.length} exercises`}>
                <span className={`badge ${BADGE[session.status]}`}>{STATUS[session.status]}</span>
              </CardHead>
              <ol className="exercise-list">
                {session.exercises.map((x, i) => <Exercise key={x.exerciseId} x={x} index={i} />)}
              </ol>
              {logError && <Notice tone="error">{logError}</Notice>}
              <SessionLog key={session._id} session={session} onLog={log} busy={busy} />
            </section>
          )}
        </div>
        <aside className="stack">
          <section className="card">
            <CardHead title="Why this plan" />
            <p className="muted" style={{ fontSize: 13.5, color: 'var(--text-2)' }}>{current.rationale}</p>
            <div style={{ marginTop: 14 }}><AgentTrace trace={current.trace} summary="How it was built" /></div>
          </section>
          <Rebuild onDone={reload} />
          {next && (
            <section className="card">
              <CardHead title="Next week" description={`From ${shortDate(next.weekStart)}`} />
              <ul className="suggest-list">
                {next.sessions.map((s) => <li key={s._id}><span>{DAYS[s.day]}</span><span className="meta">{s.title}</span></li>)}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
