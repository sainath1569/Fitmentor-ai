import { Link } from 'react-router-dom';
import { Icon } from './Icon.jsx';

export function Notice({ tone = 'info', children }) {
  return <p className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : undefined}>{children}</p>;
}

export function Loading({ what }) {
  return (
    <div className="loading" role="status">
      <span className="sr-only">Loading {what}…</span>
      <div className="skeleton" style={{ width: '30%', height: 24 }} />
      <div className="skeleton" style={{ width: '50%' }} />
      <div className="skeleton lg" />
      <div className="skeleton lg" />
    </div>
  );
}

export function PageError({ error, onRetry }) {
  return (
    <div className="page-error">
      <span className="card-icon"><Icon name="retry" /></span>
      <h2>Couldn’t load this page</h2>
      <p>{error?.message || 'Something went wrong. Please try again.'}</p>
      {onRetry && <button type="button" className="btn" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function EmptyState({ icon = 'spark', title, children, action, to, onAction }) {
  return (
    <div className="empty">
      <span className="card-icon"><Icon name={icon} /></span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action && (to
        ? <Link className="btn btn-sm" to={to}>{action}</Link>
        : <button type="button" className="btn btn-sm" onClick={onAction}>{action}</button>)}
    </div>
  );
}

export function PageHeading({ overline, title, description, children }) {
  return (
    <header className="page-head">
      <div>
        {overline && <p className="overline">{overline}</p>}
        <h1>{title}</h1>
        {description && <p className="sub">{description}</p>}
      </div>
      {children && <div className="actions">{children}</div>}
    </header>
  );
}

export function CardHead({ title, description, children }) {
  return (
    <div className="card-head">
      <div><h2>{title}</h2>{description && <p>{description}</p>}</div>
      {children}
    </div>
  );
}

/** Shows how the agents reached a result, so advice is never a black box. */
export function AgentTrace({ trace, summary }) {
  if (!trace?.length) return null;
  return (
    <details className="trace">
      <summary>{summary}</summary>
      <ol>
        {trace.map((step) => (
          <li key={`${step.agent}-${step.did}`}>
            <strong>{step.agent}</strong>
            <span>{step.did}</span>
            <small>{step.by === 'rules' ? 'Rules' : `AI · ${step.by}`}</small>
          </li>
        ))}
      </ol>
    </details>
  );
}

export function Suggestions({ data, title = 'Ideas to close the gap' }) {
  if (!data?.extras?.length && !data?.messTip) return null;
  return (
    <section className="card" aria-label={title}>
      <CardHead title={title} description={data.messTip || 'Cheap additions that fit what’s left today.'} />
      <ul className="suggest-list">
        {data.extras?.map((x) => (
          <li key={x.id}>
            <span><strong>{x.name}</strong><small>{x.serving}</small></span>
            <span className="meta">{x.protein} g protein<small>₹{x.priceInr}</small></span>
          </li>
        ))}
      </ul>
    </section>
  );
}
