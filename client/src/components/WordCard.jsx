import React from 'react';

export default function WordCard({ word, revealed, onReveal }) {
  if (!word) {
    return <div className="word-card word-card-empty">…waiting for role assignment</div>;
  }
  if (!revealed) {
    return (
      <button className="word-card word-card-hidden" onClick={onReveal}>
        <span className="tap-to-reveal">Tap to reveal your word</span>
      </button>
    );
  }
  return (
    <div className="word-card word-card-revealed">
      <div className="word-value">{word}</div>
    </div>
  );
}
