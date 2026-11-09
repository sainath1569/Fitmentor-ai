import { Link } from 'react-router-dom';
import { CardHead, EmptyState, Loading, Notice, PageError, PageHeading, Suggestions } from '../components/Bits.jsx';
import { Icon } from '../components/Icon.jsx';
import { NutritionOverview } from '../components/NutritionOverview.jsx';
import { WeightCheckIn } from '../components/WeightCheckIn.jsx';
import { api, DAYS, longDate, num } from '../lib/api.js';
import { useLoad } from '../lib/useLoad.js';

const SLOT = { breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack', dinner: 'Dinner' };
const pct = (a, b) => (b > 0 ? Math.min(100, Math.max(0, (a / b) * 100)) : 0);

function SessionCard({ session, next, hasPlan }) {
  if (!hasPlan) {
    return <section className="card"><EmptyState icon="training" title="No training plan yet" action="Create a plan" to="/training">Get a weekly plan built around your equipment and schedule.</EmptyState></section>;
  }
  if (!session) {
    return (
      <section className="card">
        <CardHead title="Rest day" description={next ? `Next: ${next.title} on ${DAYS[next.day]}` : 'No more sessions this week.'} />
        <Link className="link" to="/training">View week</Link>
      </section>
    );
  }
  const logged = session.status !== 'planned';
  return (
    <section className="card session-preview">
      <CardHead title={session.title} description={`Today · ${session.minutes} min · ${session.exercises.length} exercises`}>
        {logged && <span className="badge badge-good">{session.status === 'skipped' ? 'Skipped' : 'Logged'}</span>}
      </CardHead>
      <ul>
        {session.exercises.slice(0, 4).map((x) => <li key={x.exerciseId}><span>{x.name}</span><span>{x.sets > 1 ? `${x.sets} × ${x.reps}` : x.reps}</span></li>)}
      </ul>
      <Link className="btn btn-block" to="/training">{logged ? 'View session' : 'Start session'}</Link>
    </section>
  );
}

export function Today({ user }) {
  const { data, error, loading, reload } = useLoad(() => api.get('/today'));
  if (loading) return <Loading what="your day" />;
  if (!data) return <PageError error={error} onRetry={reload} />;
  const kcalLeft = Math.max(0, data.remaining.kcal);
  const proteinLeft = Math.max(0, data.remaining.protein);

  return (
    <div className="page">
      <PageHeading overline={longDate(data.date)} title={`Good to see you, ${user.name.split(' ')[0]}`}>
        <Link className="btn btn-primary" to="/log"><Icon name="plus" size={16} /> Log meal</Link>
      </PageHeading>

      <div className="stats">
        <div className="stat"><span className="stat-label"><em><Icon name="flame" size={15} weight="fill" /></em>Calories left</span><strong>{num(kcalLeft)}</strong><div className="bar"><i style={{ width: `${pct(data.totals.kcal, data.targets.kcal)}%` }} /></div></div>
        <div className="stat"><span className="stat-label"><em><Icon name="bolt" size={15} weight="fill" /></em>Protein left</span><strong>{num(proteinLeft)} g</strong><div className="bar"><i style={{ width: `${pct(data.totals.protein, data.targets.protein)}%` }} /></div></div>
        <div className="stat"><span className="stat-label"><em><Icon name="wallet" size={15} weight="fill" /></em>Budget left</span><strong>₹{num(data.budgetLeft)}</strong><small>of ₹{num(data.budget)} today</small></div>
        <div className="stat"><span className="stat-label"><em><Icon name="food" size={15} weight="fill" /></em>Meals logged</span><strong>{data.meals.length}</strong><small>{data.meals.length ? 'Keep going' : 'None yet'}</small></div>
      </div>

      <div className="grid-main">
        <div className="stack">
          <section className="card">
            <CardHead title="Nutrition" description="Today against your targets" />
            <NutritionOverview totals={data.totals} targets={data.targets} />
          </section>
          <section className="card">
            <CardHead title="Meals">{data.meals.length > 0 && <Link className="link" to="/log">Add meal</Link>}</CardHead>
            {data.meals.length ? (
              <ul className="meal-rows">
                {data.meals.map((m) => (
                  <li key={m._id} className="meal-row">
                    <span className="meal-thumb">{m.imageFile ? <img src={`/api/meals/${m._id}/image`} alt="" /> : <Icon name="food" />}</span>
                    <div><strong>{SLOT[m.slot]}</strong><span>{m.items.map((i) => i.name).join(', ')}</span></div>
                    <span className="meal-kcal">{num(m.items.reduce((s, i) => s + i.kcal, 0))} kcal</span>
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon="food" title="No meals logged today" action="Log your first meal" to="/log">Snap a photo or type what you ate.</EmptyState>}
          </section>
          <SessionCard session={data.session} next={data.nextSession} hasPlan={Boolean(data.planId)} />
        </div>
        <div className="stack">
          {user.assessment?.flags?.[0] && !data.meals.length && <Notice>{user.assessment.flags[0]}</Notice>}
          <WeightCheckIn />
          <Suggestions data={data.suggestions} />
        </div>
      </div>
    </div>
  );
}
