import React, { useState } from 'react';

export default function VotePanel({
  players,
  meId,
  alive,
  runoffCandidates,
  votesReceived,
  onVote,
  isHost,
  onForceTally,
}) {
  const [myVote, setMyVote] = useState(null);

  const runoff = runoffCandidates && runoffCandidates.length > 0;
  const targets = players.filter((p) => {
    if (!p.alive) return false;
    if (p.id === meId) return false;
    if (runoff && !runoffCandidates.includes(p.id)) return false;
    return true;
  });

  const alreadyVoted = votesReceived?.voterIds?.includes(meId);
  const canVote = alive && !alreadyVoted;
  const iAmInRunoff = runoff && runoffCandidates.includes(meId);

  function submit(id) {
    setMyVote(id);
    onVote(id);
  }

  return (
    <div className="card">
      <h3 className="section-title">
        {runoff ? 'Runoff vote — tied players only' : 'Vote to eliminate'}
      </h3>
      <div className="hint">
        {votesReceived?.needed
          ? `${votesReceived.count} of ${votesReceived.needed} votes in`
          : 'Cast your vote.'}
      </div>
      {!alive && <div className="banner banner-info">You're eliminated — you can't vote.</div>}
      {iAmInRunoff && (
        <div className="banner banner-info">
          You are one of the tied players — you don't vote in the runoff.
        </div>
      )}
      <div className="vote-grid">
        {targets.map((p) => (
          <button
            key={p.id}
            className={`vote-btn ${myVote === p.id ? 'vote-btn-active' : ''}`}
            disabled={!canVote || (runoff && iAmInRunoff)}
            onClick={() => submit(p.id)}
          >
            {p.nickname}
          </button>
        ))}
      </div>
      {alreadyVoted && (
        <div className="hint" style={{ marginTop: 10 }}>Vote locked. Waiting for others…</div>
      )}
      {isHost && (
        <button
          className="btn btn-secondary"
          style={{ marginTop: 16 }}
          onClick={onForceTally}
          title="Tally with whatever votes are in"
        >
          Force tally now
        </button>
      )}
    </div>
  );
}
