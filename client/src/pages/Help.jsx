import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeading } from '../components/Bits.jsx';
import { Icon } from '../components/Icon.jsx';
import { replayTour } from '../components/Tour.jsx';

const GUIDES = [
  { to: '/log', icon: 'camera', title: 'Log a meal', body: 'Snap your plate or type it. Check the estimate, fix portions, save.' },
  { to: '/training', icon: 'training', title: 'Train today', body: 'Open today’s session, watch the 3D form video, log your sets.' },
  { to: '/', icon: 'weight', title: 'Weigh in', body: 'Same time every morning. Watch the 7-day average, not one day.' },
  { to: '/coach', icon: 'chat', title: 'Ask the coach', body: 'Questions about food, training or your week, answered from your data.' },
];

const FAQ = [
  ['Getting started', [
    ['How are my calorie and protein targets set?', 'From the goal, body details and activity level in your profile. Change any of them in Profile and the targets recalculate.'],
    ['Can I change my goal later?', 'Yes. Open Profile, update your goal, diet, budget or schedule, and save. Your next plan uses the new details.'],
  ]],
  ['Food', [
    ['How accurate are photo estimates?', 'They are estimates. Always check the items and portions before saving; you can edit every row.'],
    ['My mess food isn’t recognised. What now?', 'Type it instead, e.g. “2 rotis, dal, rice”. You can adjust portions on the review screen.'],
    ['What does “Budget left” mean?', 'The daily food budget from your profile minus what today’s logged meals cost.'],
  ]],
  ['Training', [
    ['What are the 3D videos?', 'Animated form guides that show the movement and the muscles working. Tap the play button on any exercise.'],
    ['I don’t have a gym. Will the plan still work?', 'Yes. Plans use only the equipment you picked, down to bodyweight moves for a hostel room.'],
    ['I missed a session.', 'Mark it skipped and carry on. The weekly review adjusts next week instead of piling it on.'],
  ]],
  ['Progress & account', [
    ['Why does my weight jump around?', 'Water, salt and food in your gut change day to day. The 7-day average is the number to watch.'],
    ['Is my data private?', 'Yes. Your logs, photos and weight are visible only in your account.'],
    ['Is this medical advice?', 'No. FitMentor gives estimates and general guidance. Talk to a doctor about any medical condition or injury.'],
  ]],
];

export function Help() {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const groups = FAQ.map(([title, items]) => [title, items.filter(([a, b]) => !q || `${a} ${b}`.toLowerCase().includes(q))]).filter(([, items]) => items.length);

  return (
    <div className="page page-narrow help">
      <PageHeading overline="Support" title="Help & FAQ" description="Quick guides and answers. Can’t find it? Ask the coach.">
        <button type="button" className="btn" onClick={replayTour}><Icon name="play" size={15} weight="fill" />Replay demo</button>
      </PageHeading>

      <div className="help-guides">
        {GUIDES.map((g) => (
          <Link key={g.title} to={g.to} className="help-guide">
            <span className="card-icon"><Icon name={g.icon} /></span>
            <strong>{g.title}</strong>
            <span>{g.body}</span>
          </Link>
        ))}
      </div>

      <label className="help-search">
        <span className="sr-only">Search help</span>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search questions…" />
      </label>

      {groups.length ? groups.map(([title, items]) => (
        <section key={title} className="help-group">
          <h2>{title}</h2>
          {items.map(([question, answer]) => (
            <details key={question} className="report" open={Boolean(q)}>
              <summary>{question}</summary>
              <div className="report-body"><p>{answer}</p></div>
            </details>
          ))}
        </section>
      )) : <p className="muted">No answers match “{query}”.</p>}

      <section className="card help-cta">
        <div><h2>Still stuck?</h2><p className="muted">The coach knows your logs, targets and plan.</p></div>
        <Link className="btn btn-primary" to="/coach"><Icon name="chat" size={16} /> Ask the coach</Link>
      </section>
    </div>
  );
}
