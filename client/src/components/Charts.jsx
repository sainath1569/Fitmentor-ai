import { useEffect, useRef, useState } from 'react';

const HEIGHT = 220;
const PAD = { top: 16, right: 14, bottom: 26, left: 40 };

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(560);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

function niceRange(values, zeroBased) {
  const min = zeroBased ? 0 : Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = 10 ** Math.floor(Math.log10(span / 3));
  const unit = [1, 2, 5, 10].map((m) => m * step).find((s) => span / s <= 4);
  const lo = Math.floor(min / unit) * unit;
  let hi = Math.ceil(max / unit) * unit;
  if (hi === lo) hi = lo + unit;
  const ticks = [];
  for (let t = lo; t <= hi + unit / 2; t += unit) ticks.push(Number(t.toFixed(4)));
  return { lo, hi, ticks };
}

function Frame({ width, ticks, y, xLabels, children, onMove, onLeave }) {
  return (
    <svg width={width} height={HEIGHT} onPointerMove={onMove} onPointerLeave={onLeave} aria-hidden="true">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className="grid" />
          <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="axis">{t}</text>
        </g>
      ))}
      {xLabels.map((l) => <text key={l.text} x={l.x} y={HEIGHT - 6} textAnchor={l.anchor} className="axis">{l.text}</text>)}
      {children}
    </svg>
  );
}

function Tooltip({ x, width, title, value }) {
  const left = Math.min(Math.max(x, 60), width - 60);
  return <div className="chart-tip" style={{ left }}><span>{title}</span><strong>{value}</strong></div>;
}

function DataTable({ caption, columns, rows }) {
  return (
    <details className="chart-table">
      <summary>Show as a table</summary>
      <table>
        <caption className="sr-only">{caption}</caption>
        <thead><tr>{columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
        <tbody>{rows.map((r) => <tr key={r[0]}>{r.map((cell, i) => <td key={`${r[0]}-${columns[i]}`}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </details>
  );
}

export function LineChart({ points, unit, caption }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const { lo, hi, ticks } = niceRange(points.map((p) => p.value), false);
  const innerW = width - PAD.left - PAD.right;
  const x = (i) => PAD.left + (points.length > 1 ? (i / (points.length - 1)) * innerW : innerW / 2);
  const y = (v) => PAD.top + (1 - (v - lo) / (hi - lo)) * (HEIGHT - PAD.top - PAD.bottom);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)} ${y(p.value)}`).join(' ');
  const last = points.length - 1;
  const onMove = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - box.left - PAD.left) / innerW;
    setHover(Math.min(Math.max(Math.round(ratio * last), 0), last));
  };
  return (
    <div className="chart" ref={ref}>
      <Frame
        width={width} ticks={ticks} y={y} onMove={onMove} onLeave={() => setHover(null)}
        xLabels={points.length > 1
          ? [{ text: points[0].label, x: PAD.left, anchor: 'start' }, { text: points[last].label, x: width - PAD.right, anchor: 'end' }]
          : [{ text: points[0].label, x: x(0), anchor: 'middle' }]}
      >
        <path d={path} fill="none" stroke="var(--chart)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={HEIGHT - PAD.bottom} className="crosshair" />}
        <circle cx={x(hover ?? last)} cy={y(points[hover ?? last].value)} r="5" fill="var(--chart)" stroke="var(--surface)" strokeWidth="2" />
      </Frame>
      {hover !== null && <Tooltip x={x(hover)} width={width} title={points[hover].label} value={`${points[hover].value} ${unit}`} />}
      <DataTable caption={caption} columns={['Date', `Weight (${unit})`]} rows={points.map((p) => [p.label, p.value])} />
    </div>
  );
}

export function BarChart({ bars, unit, target, targetLabel, caption, valueLabel, max }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const { lo, hi, ticks } = niceRange([...bars.map((b) => b.value ?? 0), target ?? 0, max ?? 0], true);
  const innerW = width - PAD.left - PAD.right;
  const slot = innerW / bars.length;
  const barW = Math.min(Math.max(slot - 2, 3), 34);
  const y = (v) => PAD.top + (1 - (v - lo) / (hi - lo)) * (HEIGHT - PAD.top - PAD.bottom);
  const base = y(0);
  const cx = (i) => PAD.left + slot * i + slot / 2;
  const last = bars.length - 1;
  return (
    <div className="chart" ref={ref}>
      <Frame
        width={width} ticks={ticks} y={y} onLeave={() => setHover(null)}
        xLabels={bars.length > 1
          ? [{ text: bars[0].label, x: PAD.left, anchor: 'start' }, { text: bars[last].label, x: width - PAD.right, anchor: 'end' }]
          : [{ text: bars[0].label, x: cx(0), anchor: 'middle' }]}
      >
        {bars.map((b, i) => {
          const hasValue = Number.isFinite(b.value);
          const h = hasValue ? Math.max(base - y(b.value), 2) : 0;
          const r = Math.min(4, barW / 2, h);
          const left = cx(i) - barW / 2;
          return (
            <g key={b.label} onPointerEnter={() => setHover(i)}>
              <rect x={PAD.left + slot * i} y={PAD.top} width={slot} height={base - PAD.top} fill="transparent" />
              {hasValue ? (
                <path
                  d={`M${left} ${base}V${base - h + r}Q${left} ${base - h} ${left + r} ${base - h}H${left + barW - r}Q${left + barW} ${base - h} ${left + barW} ${base - h + r}V${base}Z`}
                  fill="var(--chart)" opacity={hover === null || hover === i ? 1 : 0.55}
                />
              ) : <line x1={left} x2={left + barW} y1={base} y2={base} className="missing" />}
            </g>
          );
        })}
        {target ? (
          <g>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(target)} y2={y(target)} className="target" />
            <text x={width - PAD.right} y={y(target) - 6} textAnchor="end" className="axis strong">{targetLabel}</text>
          </g>
        ) : null}
      </Frame>
      {hover !== null && (
        <Tooltip x={cx(hover)} width={width} title={bars[hover].label} value={Number.isFinite(bars[hover].value) ? `${bars[hover].display ?? bars[hover].value} ${unit}` : 'Nothing logged'} />
      )}
      <DataTable caption={caption} columns={['Date', valueLabel]} rows={bars.map((b) => [b.label, Number.isFinite(b.value) ? `${b.display ?? b.value} ${unit}` : 'Nothing logged'])} />
    </div>
  );
}
