import React from 'react';

export default function PlayerList({ players, hostId, meId, canKick, onKick }) {
  return (
    <ul className="player-list">
      {players.map((p) => (
        <li key={p.id} className={`player-item ${p.alive ? '' : 'dim'}`}>
          <span className={`dot ${p.connected ? 'dot-on' : 'dot-off'}`} />
          <span className="player-name">
            {p.nickname}
            {p.id === meId && <span className="you-tag"> · you</span>}
            {p.id === hostId && <span className="host-tag"> · host</span>}
            {!p.alive && <span className="dead-tag"> · out</span>}
          </span>
          {canKick && p.id !== meId && (
            <button
              className="link-btn danger"
              title="Kick from room"
              onClick={() => {
                if (window.confirm(`Kick ${p.nickname} from the room?`)) onKick(p.id);
              }}
            >
              kick
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
