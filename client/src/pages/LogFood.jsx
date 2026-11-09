import { useEffect, useRef, useState } from 'react';
import { CardHead, EmptyState, Loading, Notice, PageError, PageHeading, Suggestions } from '../components/Bits.jsx';
import { Icon } from '../components/Icon.jsx';
import { PhotoUpload } from '../components/PhotoUpload.jsx';
import { api, num } from '../lib/api.js';
import { useLoad } from '../lib/useLoad.js';

const SLOTS = [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['snack', 'Snack'], ['dinner', 'Dinner']];

function slotForNow() {
  const hour = new Date().getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 19) return 'snack';
  return 'dinner';
}

const scale = (item, quantity) => {
  const ratio = quantity / (item.quantity || 1);
  const by = (n, places = 1) => Number((n * ratio).toFixed(places));
  return { ...item, quantity, kcal: by(item.kcal, 0), protein: by(item.protein), carbs: by(item.carbs), fat: by(item.fat), priceInr: by(item.priceInr ?? 0, 0) };
};

function DraftRow({ item, onQuantity, onRemove }) {
  const unsure = item.confidence !== undefined && item.confidence < 0.6;
  return (
    <li className="draft-row">
      <div>
        <strong>{item.name}</strong>
        <small>{item.serving ?? 'As entered'}{item.source === 'ai' ? ' · AI estimate' : ''}</small>
        {unsure && <span className="badge badge-warn" style={{ marginTop: 4 }}>Low confidence</span>}
      </div>
      <label>
        <span className="sr-only">Servings of {item.name}</span>
        <input type="number" min="0.25" max="20" step="0.25" value={item.quantity} onChange={(e) => { if (Number(e.target.value) > 0) onQuantity(Number(e.target.value)); }} />
      </label>
      <span className="nums">{num(item.kcal)} kcal · {Math.round(item.protein)} g P</span>
      <button type="button" className="icon-btn" onClick={onRemove} aria-label={`Remove ${item.name}`}><Icon name="close" size={14} /></button>
    </li>
  );
}

function ManualAdd({ name, onAdd }) {
  const [v, setV] = useState({ kcal: '', protein: '' });
  return (
    <div className="notice stack-sm">
      <span>We couldn’t find <strong>“{name}”</strong>. Add its values yourself:</span>
      <div className="field-row">
        <label>Calories<input type="number" min="0" value={v.kcal} onChange={(e) => setV({ ...v, kcal: e.target.value })} /></label>
        <label>Protein (g)<input type="number" min="0" value={v.protein} onChange={(e) => setV({ ...v, protein: e.target.value })} /></label>
        <button type="button" className="btn" disabled={!v.kcal}
          onClick={() => onAdd({ name, quantity: 1, serving: 'as entered', kcal: Number(v.kcal), protein: Number(v.protein || 0), carbs: 0, fat: 0, priceInr: 0, source: 'manual' })}>Add</button>
      </div>
    </div>
  );
}

export function LogFood({ ai }) {
  const day = useLoad(() => api.get('/meals'));
  const [mode, setMode] = useState(ai.vision ? 'photo' : 'type');
  const [slot, setSlot] = useState(slotForNow);
  const [text, setText] = useState('');
  const [draft, setDraft] = useState(null);
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState({ busy: '', error: '', done: '' });
  const uploadController = useRef(null);
  const selectionId = useRef(0);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => () => { uploadController.current?.abort(); selectionId.current += 1; }, []);

  const clear = { busy: '', error: '', done: '' };
  const fail = (err) => setStatus({ busy: '', error: err.message, done: '' });
  const reset = () => { selectionId.current += 1; uploadController.current?.abort(); setDraft(null); setPreview(null); setFile(null); setText(''); };
  const switchMode = (next) => { setMode(next); reset(); setStatus(clear); };

  const selectPhoto = async (selected, selectionError) => {
    const id = ++selectionId.current;
    setDraft(null); setFile(null); setPreview(null);
    setStatus(clear);
    if (selectionError) return fail(new Error(selectionError));
    if (!selected) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type)) return fail(new Error('Use a JPG, PNG or WebP photo.'));
    if (!selected.size) return fail(new Error('This file is empty. Choose another photo.'));
    if (selected.size > 6 * 1024 * 1024) return fail(new Error('Choose a photo under 6 MB.'));
    const url = URL.createObjectURL(selected);
    try {
      const image = new Image(); image.src = url; await image.decode();
      if (id !== selectionId.current) { URL.revokeObjectURL(url); return; }
      setFile(selected); setPreview(url);
    } catch {
      URL.revokeObjectURL(url);
      if (id === selectionId.current) fail(new Error('That photo couldn’t be opened. Try another image.'));
    }
  };

  const scan = async () => {
    if (!file) return;
    setDraft(null);
    setStatus({ busy: 'Scanning your meal…', error: '', done: '' });
    const form = new FormData();
    form.append('image', file);
    uploadController.current?.abort();
    const controller = new AbortController(); uploadController.current = controller;
    try {
      const result = await api.upload('/meals/analyze', form, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setDraft({ ...result, unmatched: [] });
      setStatus(clear);
    } catch (err) {
      if (err.name !== 'AbortError') fail(err);
    }
  };

  const parse = async (e) => {
    e.preventDefault();
    setStatus({ busy: 'Looking up your meal…', error: '', done: '' });
    try {
      setDraft(await api.post('/meals/parse', { text }));
      setStatus(clear);
    } catch (err) {
      fail(err);
    }
  };

  const save = async () => {
    setStatus({ busy: 'Saving…', error: '', done: '' });
    try {
      await api.post('/meals', {
        date: day.data.date, slot, imageToken: draft.imageToken,
        items: draft.items.map(({ name, foodId, quantity, serving, kcal, protein, carbs, fat, priceInr, source, confidence }) => ({
          name, foodId, quantity, serving, kcal, protein, carbs, fat, priceInr: priceInr ?? 0, source, confidence,
        })),
      });
      reset();
      setStatus({ busy: '', error: '', done: 'Meal saved.' });
      day.reload();
    } catch (err) {
      fail(err);
    }
  };

  const remove = async (id) => {
    try { await api.del(`/meals/${id}`); day.reload(); } catch (err) { fail(err); }
  };

  const updateItem = (i, next) => setDraft((d) => ({ ...d, items: d.items.map((x, n) => (n === i ? next : x)) }));
  const removeItem = (i) => setDraft((d) => ({ ...d, items: d.items.filter((_, n) => n !== i) }));
  const addManual = (item) => setDraft((d) => ({ ...d, items: [...d.items, item], unmatched: d.unmatched.filter((u) => u !== item.name) }));
  const kcal = draft?.items.reduce((s, x) => s + x.kcal, 0) ?? 0;
  const protein = draft?.items.reduce((s, x) => s + x.protein, 0) ?? 0;

  return (
    <div className="page">
      <PageHeading title="Log a meal" description="Upload a photo or describe what you ate. Review the estimate, then save." />
      <div className="grid-main">
        <div className="stack">
          <section className="card stack">
            <div className="segmented" role="group" aria-label="How to log">
              <button type="button" disabled={Boolean(status.busy)} aria-pressed={mode === 'photo'} onClick={() => switchMode('photo')}><Icon name="camera" size={15} /> Photo</button>
              <button type="button" disabled={Boolean(status.busy)} aria-pressed={mode === 'type'} onClick={() => switchMode('type')}><Icon name="file" size={15} /> Describe</button>
            </div>
            {mode === 'photo' ? (
              <PhotoUpload file={file} preview={preview} busy={Boolean(status.busy)} available={ai.vision} onSelect={selectPhoto}
                onClear={() => { reset(); setStatus(clear); }} onScan={scan} onType={() => switchMode('type')} analyzed={Boolean(draft)} />
            ) : (
              <form onSubmit={parse} className="stack">
                <label>What did you eat?
                  <textarea rows="4" required maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. 3 chapati, dal, 1 cup rice and curd" />
                  <span className="hint">Include portions where you can for a more accurate estimate.</span>
                </label>
                <div className="form-actions"><button type="submit" className="btn btn-primary" disabled={!text.trim() || Boolean(status.busy)}>Analyze meal</button></div>
              </form>
            )}
            {status.busy && <p className="muted" role="status">{status.busy}</p>}
            {status.error && <Notice tone="error">{status.error}</Notice>}
            {status.done && <Notice tone="good">{status.done}</Notice>}
          </section>

          {draft && (
            <section className="card stack">
              <CardHead title="Review meal" description="Adjust servings or remove items before saving." />
              {draft.items.length > 0 && (
                <ul className="draft-list">
                  {draft.items.map((item, i) => (
                    <DraftRow key={`${item.name}-${i}`} item={item} onQuantity={(q) => updateItem(i, scale(item, q))} onRemove={() => removeItem(i)} />
                  ))}
                </ul>
              )}
              {draft.unmatched?.map((name) => <ManualAdd key={name} name={name} onAdd={addManual} />)}
              {draft.swaps?.map((s) => <p key={s.from} className="swap"><strong>Swap {s.from} for {s.to}.</strong> {s.reason} (about ₹{s.priceInr}).</p>)}
              <fieldset className="choices">
                <legend>Meal</legend>
                <div>
                  {SLOTS.map(([v, label]) => (
                    <label key={v} className={slot === v ? 'chip on' : 'chip'}>
                      <input type="radio" name="meal-slot" checked={slot === v} onChange={() => setSlot(v)} />{label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="total-bar">
                <span>Total <strong>{num(kcal)} kcal</strong> · <strong>{Math.round(protein)} g</strong> protein</span>
                <button type="button" className="btn btn-primary" onClick={save} disabled={!draft.items.length || Boolean(status.busy) || !day.data}>Save meal</button>
              </div>
            </section>
          )}
        </div>

        <aside className="stack">
          <section className="card">
            {day.loading && <Loading what="today’s meals" />}
            {!day.data && day.error && <PageError error={day.error} onRetry={day.reload} />}
            {day.data && (
              <>
                <CardHead title="Today" description={`${num(day.data.totals.kcal)} / ${num(day.data.targets.kcal)} kcal · ${Math.round(day.data.totals.protein)} / ${day.data.targets.protein} g protein`} />
                {day.data.meals.length === 0 ? (
                  <EmptyState icon="food" title="Nothing logged yet">Saved meals will appear here.</EmptyState>
                ) : (
                  <ul className="meal-rows">
                    {day.data.meals.map((m) => (
                      <li key={m._id} className="meal-row">
                        <span className="meal-thumb">{m.imageFile ? <img src={`/api/meals/${m._id}/image`} alt="" /> : <Icon name="food" />}</span>
                        <div><strong>{SLOTS.find(([v]) => v === m.slot)[1]}</strong><span>{m.items.map((i) => i.name).join(', ')}</span></div>
                        <button type="button" className="icon-btn" onClick={() => remove(m._id)} aria-label={`Delete ${m.slot}`}><Icon name="close" size={14} /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
          {draft?.suggestions && <Suggestions data={draft.suggestions} title="After this meal, consider" />}
        </aside>
      </div>
    </div>
  );
}
