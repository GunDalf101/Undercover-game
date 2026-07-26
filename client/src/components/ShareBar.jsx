import React from 'react';

export default function ShareBar({ shareUrl, onCopy, copied }) {
  return (
    <div className="share-bar">
      <input className="input mono" readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
      <button className="btn btn-secondary" onClick={onCopy}>
        {copied ? 'Copied!' : 'Copy link'}
      </button>
    </div>
  );
}
