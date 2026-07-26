import React from 'react';

export default function ThemePicker({ themes, value, onChange }) {
  if (!themes || themes.length === 0) {
    return <div className="hint">Loading themes…</div>;
  }
  return (
    <div className="theme-picker">
      <div className="eyebrow">Theme</div>
      <div className="theme-grid">
        {themes.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`theme-card ${value === t.id ? 'theme-card-active' : ''}`}
            onClick={() => onChange(t.id)}
          >
            <div className="theme-name">{t.name}</div>
            <div className="theme-pairs">{t.pairCount} word pairs</div>
          </button>
        ))}
      </div>
    </div>
  );
}
