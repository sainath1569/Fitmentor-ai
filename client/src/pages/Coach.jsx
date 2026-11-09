import { useEffect, useRef, useState } from 'react';
import { Loading, Notice, PageError, PageHeading } from '../components/Bits.jsx';
import { Icon } from '../components/Icon.jsx';
import { api } from '../lib/api.js';
import { useLoad } from '../lib/useLoad.js';

const STARTERS = [
  'How do I get more protein from mess food?',
  'I have exams next week. What should I change?',
  'What can I buy for ₹20 after dinner?',
];

export function Coach({ ai }) {
  const history = useLoad(() => api.get('/coach/messages'));
  const [messages, setMessages] = useState(null);
  const [text, setText] = useState('');
  const [state, setState] = useState({ busy: false, error: '' });
  const end = useRef(null);
  const list = messages ?? history.data?.messages ?? [];

  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [list.length, state.busy]);

  const send = async (content) => {
    const message = content.trim();
    if (!message || state.busy) return;
    const shown = [...list, { _id: `local-${Date.now()}`, role: 'user', content: message }];
    setMessages(shown);
    setText('');
    setState({ busy: true, error: '' });
    try {
      const { reply } = await api.post('/coach/messages', { message });
      setMessages([...shown, reply]);
      setState({ busy: false, error: '' });
    } catch (err) {
      setMessages(list);
      setText(message);
      setState({ busy: false, error: err.message });
    }
  };

  if (history.loading) return <Loading what="your chat" />;
  if (!history.data) return <PageError error={history.error} onRetry={history.reload} />;

  return (
    <div className="page">
      <PageHeading title="Coach" description="Ask about food, training or your week. Answers use your logs and plan." />
      {!ai.text && <Notice>AI replies are off, so the coach is using built-in guidance.</Notice>}
      <section className="card chat-card">
        <ul className="chat" aria-live="polite">
          {list.length === 0 && (
            <li className="chat-empty">
              <span className="card-icon"><Icon name="chat" /></span>
              <h3>Start a conversation</h3>
              <p>Try one of these, or ask your own question.</p>
              <div className="starters">
                {STARTERS.map((s) => <button type="button" className="starter" key={s} onClick={() => send(s)}>{s}<Icon name="arrow" size={14} /></button>)}
              </div>
            </li>
          )}
          {list.map((m) => (
            <li key={m._id} className={`msg msg-${m.role}`}>
              <p>{m.content}</p>
              {m.sources?.length > 0 && <small>Sources: {m.sources.slice(0, 3).join(', ')}</small>}
            </li>
          ))}
          {state.busy && <li className="msg msg-assistant typing" role="status"><p>Thinking…</p></li>}
          <li ref={end} aria-hidden="true" />
        </ul>
        <form className="composer" onSubmit={(e) => { e.preventDefault(); send(text); }}>
          <label className="sr-only" htmlFor="coach-input">Message</label>
          <input id="coach-input" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder="Ask a question…" autoComplete="off" />
          <button type="submit" className="btn btn-primary" disabled={!text.trim() || state.busy} aria-label="Send"><Icon name="arrow" size={17} /></button>
        </form>
      </section>
      {state.error && <Notice tone="error">{state.error}</Notice>}
    </div>
  );
}
