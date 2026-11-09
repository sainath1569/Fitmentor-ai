import { useEffect, useRef } from 'react';

// Pointer-driven 3D stage: layers sit at different depths and the whole scene tilts toward the cursor.
export function Hero3D() {
  const stage = useRef(null);

  useEffect(() => {
    const el = stage.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    let frame = 0;
    let tx = 0, ty = 0, cx = 0, cy = 0;
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      tx = ((e.clientX - (r.left + r.width / 2)) / r.width) * 2;
      ty = ((e.clientY - (r.top + r.height / 2)) / r.height) * 2;
    };
    const tick = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      el.style.setProperty('--rx', `${(-cy * 9).toFixed(2)}deg`);
      el.style.setProperty('--ry', `${(cx * 12).toFixed(2)}deg`);
      frame = requestAnimationFrame(tick);
    };
    window.addEventListener('pointermove', onMove);
    frame = requestAnimationFrame(tick);
    return () => { window.removeEventListener('pointermove', onMove); cancelAnimationFrame(frame); };
  }, []);

  return (
    <div className="stage" ref={stage} aria-hidden="true">
      <div className="scene">
        <div className="aura" />
        <div className="orbit"><span>Squat</span><span>Bench</span><span>Deadlift</span><span>Pull-up</span><span>Protein</span><span>Recover</span></div>
        <div className="plate plate-back" />
        <div className="hero-photo layer-photo"><img src="/images/movement.jpg" alt="" fetchPriority="high" /><i className="shine" /></div>
        <div className="float float-b layer-b">
          <div className="row"><span>Daily weigh-in</span><span className="badge badge-good">6-day streak</span></div>
          <strong>64.2 kg</strong>
          <div className="row" style={{ marginTop: 2 }}><span>7 days</span><span className="volt">−0.6 kg</span></div>
        </div>
        <div className="float float-a layer-a">
          <div className="row"><span>Calories left today</span><span>1,240 / 2,200</span></div>
          <strong>960 kcal</strong>
          <div className="bar"><i style={{ width: '56%' }} /></div>
          <div className="mini">
            <div className="row"><span>Protein</span><span>62 / 110 g</span></div>
            <div className="bar"><i style={{ width: '56%' }} /></div>
          </div>
        </div>
        <div className="float float-c layer-c"><span className="pr">PR</span><div><strong>100 kg</strong><small>Squat · new best</small></div></div>
      </div>
    </div>
  );
}
