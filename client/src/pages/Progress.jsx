import { useState } from 'react';
import { AgentTrace, CardHead, EmptyState, Loading, Notice, PageError, PageHeading } from '../components/Bits.jsx';
import { BarChart, LineChart } from '../components/Charts.jsx';
import { WeightCheckIn } from '../components/WeightCheckIn.jsx';
import { api, shortDate } from '../lib/api.js';
import { useLoad } from '../lib/useLoad.js';

const TRAINING_NEXT = { progress: 'Harder', hold: 'Same', deload: 'Lighter', reduce: 'Fewer sessions' };

function Report({ report, open }) {
  const { stats, decisions } = report;
  return (
    <details className="report" open={open}>
      <summary>Week of {shortDate(report.weekStart)}</summary>
      <div className="report-body">
        <p>{report.summary}</p>
        <dl className="facts">
          <div><dt>Sessions</dt><dd>{stats.done + stats.partial} / {stats.sessionsDue}</dd></div>
          <div><dt>Avg protein</dt><dd>{stats.avgProtein ? `${stats.avgProtein} g` : '—'}</dd></div>
          <div><dt>Weight change</dt><dd>{stats.weightChange === null ? '—' : `${stats.weightChange > 0 ? '+' : ''}${stats.weightChange} kg`}</dd></div>
          <div><dt>Next week</dt><dd>{TRAINING_NEXT[decisions.training]}</dd></div>
          <div><dt>Calories</dt><dd>{decisions.kcalChange > 0 ? '+' : ''}{decisions.kcalChange} kcal</dd></div>
        </dl>
        <div className="lists">
          <div><h3>What went well</h3><ul>{report.wins.map((w) => <li key={w}>{w}</li>)}</ul></div>
          {report.improvements.length > 0 && <div><h3>To work on</h3><ul>{report.improvements.map((w) => <li key={w}>{w}</li>)}</ul></div>}
        </div>
        <AgentTrace trace={report.trace} summary="How this review was made" />
      </div>
    </details>
  );
}

export function Progress() {
  const progress = useLoad(() => api.get('/progress'));
  const reports = useLoad(() => api.get('/reports'));
  const [review, setReview] = useState({ busy: false, error: '' });

  if (progress.loading) return <Loading what="your progress" />;
  if (!progress.data) return <PageError error={progress.error} onRetry={progress.reload} />;
  const { weights, nutrition, training, week } = progress.data;
  const logged = nutrition.some((n) => n.logged);

  const runReview = async () => {
    setReview({ busy: true, error: '' });
    try {
      await api.post('/reports/weekly');
      setReview({ busy: false, error: '' });
      reports.reload();
      progress.reload();
    } catch (err) {
      setReview({ busy: false, error: err.message });
    }
  };

  return (
    <div className="page">
      <PageHeading title="Progress" description="Weight, nutrition and training trends over time.">
        <button type="button" className="btn btn-primary" onClick={runReview} disabled={review.busy}>{review.busy ? 'Reviewing…' : 'Run weekly review'}</button>
      </PageHeading>
      {review.error && <Notice tone="error">{review.error}</Notice>}

      <div className="grid-main">
        <section className="card">
          <CardHead title="Weight" description="Last 8 weeks" />
          {weights.length >= 2
            ? <LineChart unit="kg" caption="Weight by date" points={weights.map((w) => ({ label: shortDate(w.date), value: w.weightKg }))} />
            : <EmptyState icon="weight" title="Not enough data yet">Log your weight on two different days to see a trend.</EmptyState>}
        </section>
        <WeightCheckIn onSaved={progress.reload} />
      </div>

      <div className="grid-2">
        <section className="card">
          <CardHead title="Protein" description={`Last 14 days · target ${week.targets.protein} g`} />
          {logged ? (
            <BarChart unit="g" valueLabel="Protein" caption="Protein eaten by day" target={week.targets.protein} targetLabel={`${week.targets.protein} g`}
              bars={nutrition.map((n) => ({ label: shortDate(n.date), value: n.logged ? Math.round(n.protein) : null }))} />
          ) : <EmptyState icon="food" title="No meals logged" action="Log a meal" to="/log">Your daily protein will appear here.</EmptyState>}
        </section>
        <section className="card">
          <CardHead title="Training consistency" description="Share of planned sessions completed" />
          {training.some((t) => t.done > 0 || t.partial > 0) ? (
            <BarChart unit="%" valueLabel="Completed" caption="Share of sessions completed by week" max={100}
              bars={training.map((t) => ({ label: shortDate(t.weekStart), value: Math.round(t.adherence * 100) }))} />
          ) : <EmptyState icon="training" title="No sessions completed" action="Go to training" to="/training">Completed sessions will show here by week.</EmptyState>}
        </section>
      </div>

      <section>
        <div className="card-head"><div><h2>Weekly reviews</h2><p>Each review checks your week, adjusts calories and plans the next week.</p></div></div>
        {reports.loading && <Loading what="reviews" />}
        {reports.error && <PageError error={reports.error} onRetry={reports.reload} />}
        {reports.data?.reports.length === 0 && <section className="card"><EmptyState icon="file" title="No reviews yet">Run your first weekly review once you’ve logged a few days.</EmptyState></section>}
        {reports.data?.reports.map((r, i) => <Report key={r._id} report={r} open={i === 0} />)}
      </section>
    </div>
  );
}
