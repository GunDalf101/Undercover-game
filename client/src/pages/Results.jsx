import React from 'react';
import { useGame } from '../state.jsx';

export default function Results() {
  const { state, playAgain, leaveRoom } = useGame();
  const { room, session } = state;
  const me = room.players.find((p) => p.id === session.playerId);
  const isHost = me?.isHost;
  const winner = room.winner;
  const reveal = room.reveal || [];

  const civilians = reveal.filter((r) => r.role === 'civilian');
  const undercovers = reveal.filter((r) => r.role === 'undercover');

  return (
    <div className="results">
      <div className="card centered">
        <div className="eyebrow">Game over</div>
        <h1 className={`title winner-${winner}`}>
          {winner === 'civilians' ? 'Civilians win!' : 'Undercovers win!'}
        </h1>
        <div className="hint">
          {winner === 'civilians'
            ? 'All undercovers have been unmasked.'
            : 'The undercovers survived long enough to take over.'}
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <h3 className="section-title">Civilians</h3>
          <div className="value big">{civilians[0]?.word || '—'}</div>
          <ul className="reveal-list">
            {civilians.map((r) => (
              <li key={r.playerId}>{r.nickname}</li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h3 className="section-title">Undercovers</h3>
          <div className="value big">{undercovers[0]?.word || '—'}</div>
          <ul className="reveal-list">
            {undercovers.map((r) => (
              <li key={r.playerId}>{r.nickname}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="row center gap">
        {isHost && (
          <button className="btn btn-primary btn-lg" onClick={playAgain}>
            Play again (same room)
          </button>
        )}
        <button className="btn btn-secondary btn-lg" onClick={leaveRoom}>
          Leave room
        </button>
      </div>
    </div>
  );
}
