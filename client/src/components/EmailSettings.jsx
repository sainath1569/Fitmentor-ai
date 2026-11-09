import { useState } from 'react';
import { api } from '../lib/api.js';
import { CardHead } from './Bits.jsx';

const label = (h) => new Date(2000, 0, 1, h).toLocaleTimeString('en-IN', { hour: 'numeric', hour12: true });

/** The evening email that says what is still left to reach today. */
export function EmailSettings({ user, setUser }) {
  const prefs = user.notifications ?? { dailyEmail: true, hour: 20 };
  const [state, setState] = useState({ busy: false, error: '', note: '' });

  const update = async (next) => {
    setState({ busy: true, error: '', note: '' });
    try {
      const saved = await api.put('/notifications', { ...prefs, ...next });
      setUser(saved.user);
      setState({ busy: false, error: '', note: '' });
    } catch (err) {
      setState({ busy: false, error: err.message, note: '' });
    }
  };
  const sendNow = async () => {
    setState({ busy: true, error: '', note: '' });
    try {
      const r = await api.post('/notifications/send');
      setState({ busy: false, error: '', note: r.outbox ? 'No mail server is configured, so the email was saved to the server outbox.' : `Sent to ${r.to}.` });
    } catch (err) {
      setState({ busy: false, error: err.message, note: '' });
    }
  };

  return (
    <section className="card">
      <CardHead title="Evening summary email" description={`A daily email to ${user.email} with the calories, protein and budget you have left, plus a weigh-in reminder.`} />
      <div className="btn-row" style={{ alignItems: 'center', gap: 16 }}>
        <label className="switch">
          <input type="checkbox" checked={prefs.dailyEmail} disabled={state.busy} onChange={(e) => update({ dailyEmail: e.target.checked })} />
          <span aria-hidden="true" />
          {prefs.dailyEmail ? 'Enabled' : 'Disabled'}
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>Send at
          <select value={prefs.hour} disabled={state.busy || !prefs.dailyEmail} onChange={(e) => update({ hour: Number(e.target.value) })} style={{ width: 'auto' }}>
            {Array.from({ length: 10 }, (_, i) => i + 14).map((h) => <option key={h} value={h}>{label(h)}</option>)}
          </select>
        </label>
        <button type="button" className="btn btn-sm" onClick={sendNow} disabled={state.busy} style={{ marginLeft: 'auto' }}>Send today’s summary</button>
      </div>
      {state.note && <p className="notice notice-good" style={{ marginTop: 12 }}>{state.note}</p>}
      {state.error && <p className="notice notice-error" role="alert" style={{ marginTop: 12 }}>{state.error}</p>}
    </section>
  );
}
