import { useRef, useState } from 'react';
import { Icon } from './Icon.jsx';

export function PhotoUpload({ file, preview, busy, available, onSelect, onClear, onScan, onType, analyzed }) {
  const input = useRef(null);
  const [dragging, setDragging] = useState(false);
  const choose = () => input.current?.click();
  const drop = (event) => {
    event.preventDefault();
    setDragging(false);
    if (!available || busy) return;
    if (event.dataTransfer.files.length !== 1) return onSelect(null, 'Choose one meal photo at a time.');
    onSelect(event.dataTransfer.files[0]);
  };

  return (
    <div className="stack">
      <input ref={input} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose a meal photo" disabled={!available || busy}
        onChange={(event) => { const selected = event.target.files?.[0]; if (selected) onSelect(selected); event.target.value = ''; }} />

      {!available && (
        <div className="notice">Photo scanning isn’t available right now. <button type="button" className="link" onClick={onType}>Type your meal instead</button></div>
      )}

      {preview ? (
        <div className={`preview ${busy ? 'scanning' : ''}`}>
          <img src={preview} alt="Your selected meal" />
          <span className="badge">{busy ? 'Scanning…' : analyzed ? <><Icon name="check" size={12} /> Scanned</> : 'Ready to scan'}</span>
        </div>
      ) : (
        <div
          className={`dropzone ${dragging ? 'dragging' : ''} ${!available ? 'disabled' : ''}`}
          onDragOver={(event) => { event.preventDefault(); if (available && !busy) setDragging(true); }}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
          onDrop={drop}
        >
          <span className="card-icon"><Icon name="camera" size={20} /></span>
          <h3>{dragging ? 'Drop the photo' : 'Upload a photo of your meal'}</h3>
          <p>Drag and drop, or choose a file. JPG, PNG or WebP up to 6 MB.</p>
          <button type="button" className="btn" onClick={choose} disabled={!available || busy}><Icon name="upload" size={16} /> Choose photo</button>
        </div>
      )}

      {file && (
        <div className="file-row">
          <span className="card-icon"><Icon name="photo" size={16} /></span>
          <div><strong title={file.name}>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(2)} MB</small></div>
          <button type="button" className="icon-btn" onClick={choose} disabled={busy} aria-label="Replace photo"><Icon name="retry" size={16} /></button>
          <button type="button" className="icon-btn" onClick={onClear} disabled={busy} aria-label="Remove photo"><Icon name="close" size={16} /></button>
        </div>
      )}
      {file && (
        <button type="button" className="btn btn-primary btn-lg" onClick={onScan} disabled={busy || !available}>
          {busy ? 'Scanning…' : analyzed ? 'Scan again' : 'Scan meal'}
        </button>
      )}
      <p className="muted">For best results, shoot from above in good light with the whole plate in frame. Always review the estimate before saving.</p>
    </div>
  );
}
