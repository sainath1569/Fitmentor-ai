import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Icon, LogoMark } from './Icon.jsx';
import { replayTour } from './Tour.jsx';

const STORE = 'fm-support-chat';
const QUICK = [
  'How do I log a meal from a photo?',
  'How do the 3D form videos work?',
  'Why does my weight jump around?',
];
const load = () => { try { return JSON.parse(sessionStorage.getItem(STORE)) ?? []; } catch { return []; } };
const AGENT = 'Spot';

// Minimal markdown for agent replies: **bold**, `code`, "- " / "1. " lists, paragraphs. Builds elements, never HTML.
const inline = (text) => text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, k) => {
  if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={k}>{part.slice(2, -2)}</strong>;
  if (part.startsWith('`') && part.endsWith('`') && part.length > 2) return <code key={k}>{part.slice(1, -1)}</code>;
  return part.replace(/\*\*/g, '');
});
function Rich({ text }) {
  const blocks = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const item = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    const ordered = /^\d/.test(line);
    const prev = blocks.at(-1);
    if (item) {
      if (prev?.type === 'list' && prev.ordered === ordered) prev.items.push(item[1]);
      else blocks.push({ type: 'list', ordered, items: [item[1]] });
    } else if (line) {
      if (prev?.type === 'p' && !prev.closed) prev.lines.push(line);
      else blocks.push({ type: 'p', lines: [line] });
    } else if (prev) prev.closed = true;
  }
  return blocks.map((b, k) => (b.type === 'list'
    ? (b.ordered ? <ol key={k}>{b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ol> : <ul key={k}>{b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ul>)
    : <p key={k}>{inline(b.lines.join(' '))}</p>));
}

function Avatar({ size = 32 }) {
  return <span className="sw-avatar" style={{ width: size, height: size }}><LogoMark /><i /></span>;
}

export function SupportWidget({ name }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('home');
  const [msgs, setMsgs] = useState(load);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const end = useRef(null);
  const input = useRef(null);

  useEffect(() => { try { sessionStorage.setItem(STORE, JSON.stringify(msgs.slice(-30))); } catch { /* not critical */ } }, [msgs]);
  useEffect(() => { if (open && view === 'chat') { end.current?.scrollIntoView({ block: 'nearest' }); input.current?.focus(); } }, [open, view, msgs.length, busy]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const send = async (content) => {
    const message = content.trim();
    if (!message || busy) return;
    const next = [...msgs, { role: 'user', content: message, at: Date.now() }];
    setMsgs(next);
    setText('');
    setError('');
    setView('chat');
    setBusy(true);
    try {
      const { reply } = await api.post('/support/messages', { messages: next.map(({ role, content: c }) => ({ role, content: c })) });
      setMsgs([...next, { role: 'assistant', content: reply.content, at: Date.now() }]);
    } catch (err) {
      setError(err.message);
      setText(message);
      setMsgs(msgs);
    } finally {
      setBusy(false);
    }
  };

  const go = (fn) => () => { setOpen(false); fn?.(); };

  return (
    <div className={`sw ${open ? 'sw-open' : ''}`}>
      {open && (
        <section className="sw-panel" role="dialog" aria-label="Support">
          {view === 'home' ? (
            <div className="sw-home">
              <header className="sw-hero">
                <div className="sw-hero-top"><Avatar size={36} /><button type="button" className="sw-x" onClick={() => setOpen(false)} aria-label="Close support"><Icon name="close" size={16} /></button></div>
                <h2>Hey {name} <span aria-hidden="true">👋</span></h2>
                <p>How can we help you today?</p>
              </header>
              <div className="sw-body">
                <button type="button" className="sw-card sw-ask" onClick={() => setView('chat')}>
                  <Avatar />
                  <span><strong>Ask {AGENT}</strong><small><i className="sw-online" />Online · replies in seconds</small></span>
                  <Icon name="next" size={16} />
                </button>
                <div className="sw-card sw-search">
                  <form onSubmit={(e) => { e.preventDefault(); send(text); }}>
                    <Icon name="spark" size={16} weight="fill" />
                    <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask a question…" aria-label="Ask a question" />
                  </form>
                  <ul>{QUICK.map((q) => <li key={q}><button type="button" onClick={() => send(q)}>{q}<Icon name="next" size={13} /></button></li>)}</ul>
                </div>
                <div className="sw-grid">
                  <Link to="/help" className="sw-tile" onClick={go()}><Icon name="help" size={20} weight="duotone" /><span>Help &amp; FAQ</span></Link>
                  <button type="button" className="sw-tile" onClick={go(replayTour)}><Icon name="play" size={20} weight="duotone" /><span>Replay demo</span></button>
                  <Link to="/coach" className="sw-tile" onClick={go()}><Icon name="chat" size={20} weight="duotone" /><span>Fitness coach</span></Link>
                  <button type="button" className="sw-tile" onClick={() => { setView('chat'); setText('Something isn’t working: '); }}><Icon name="bolt" size={20} weight="duotone" /><span>Report a problem</span></button>
                </div>
              </div>
            </div>
          ) : (
            <div className="sw-chat">
              <header className="sw-chat-head">
                <button type="button" className="sw-x" onClick={() => setView('home')} aria-label="Back"><Icon name="prev" size={16} /></button>
                <Avatar size={34} />
                <span><strong>{AGENT}</strong><small><i className="sw-online" />Support agent</small></span>
                <button type="button" className="sw-x" onClick={() => setOpen(false)} aria-label="Close support"><Icon name="close" size={16} /></button>
              </header>
              <ul className="sw-msgs" aria-live="polite">
                <li className="sw-msg bot"><p>Hi {name}! I’m {AGENT}, FitMentor’s support agent. Ask me anything about using the app.</p></li>
                {msgs.length === 0 && <li className="sw-chips">{QUICK.map((q) => <button type="button" key={q} onClick={() => send(q)}>{q}</button>)}</li>}
                {msgs.map((m) => (
                  <li key={m.at + m.role} className={`sw-msg ${m.role === 'user' ? 'me' : 'bot'}`}>
                    {m.role === 'user' ? <p>{m.content}</p> : <div className="sw-rich"><Rich text={m.content} /></div>}
                  </li>
                ))}
                {busy && <li className="sw-msg bot"><p className="sw-typing"><i /><i /><i /></p></li>}
                {error && <li className="sw-error" role="alert">{error}</li>}
                <li ref={end} />
              </ul>
              <form className="sw-composer" onSubmit={(e) => { e.preventDefault(); send(text); }}>
                <input ref={input} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message…" aria-label="Message" maxLength={1000} disabled={busy} />
                <button type="submit" disabled={busy || !text.trim()} aria-label="Send"><Icon name="arrow" size={16} /></button>
              </form>
              {msgs.length > 0 && <button type="button" className="sw-reset" onClick={() => setMsgs([])}>Start a new conversation</button>}
            </div>
          )}
        </section>
      )}
      <button type="button" className="sw-launch" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? 'Close support' : 'Open support'}>
        <span className="sw-launch-icon">{open ? <Icon name="close" size={24} /> : <Icon name="chat" size={26} weight="fill" />}</span>
      </button>
    </div>
  );
}
