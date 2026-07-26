import React, { useMemo, useState } from 'react';
import { useGame } from '../state.jsx';
import PlayerList from '../components/PlayerList.jsx';
import ThemePicker from '../components/ThemePicker.jsx';
import ShareBar from '../components/ShareBar.jsx';

export default function Lobby() {
  const { state, configure, startGame, kick } = useGame();
  const { room, session, themes } = state;
  const [copied, setCopied] = useState(false);

  const me = room.players.find((p) => p.id === session.playerId);
  const isHost = me?.isHost;
  const nPlayers = room.players.length;

  const defaultUC = nPlayers >= 7 ? 2 : 1;
  const themeId = room.config.themeId;
  const undercoverCount = room.config.undercoverCount || defaultUC;

  const canStart = useMemo(() => {
    if (!isHost) return false;
    if (nPlayers < 3) return false;
    if (!themeId) return false;
    if (undercoverCount >= nPlayers) return false;
    return true;
  }, [isHost, nPlayers, themeId, undercoverCount]);

  const shareUrl = `${window.location.origin}/r/${room.code}`;

  async function copyShare() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be blocked; ignore */
    }
  }

  return (
    <div className="lobby">
      <div className="card">
        <div className="row space-between wrap">
          <div>
            <div className="eyebrow">Room</div>
            <div className="room-code mono">{room.code}</div>
          </div>
          <ShareBar shareUrl={shareUrl} onCopy={copyShare} copied={copied} />
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <h3 className="section-title">Players ({nPlayers})</h3>
          <PlayerList
            players={room.players}
            hostId={room.hostId}
            meId={session.playerId}
            canKick={isHost}
            onKick={kick}
          />
          <div className="hint">Need 3–20 players. Share the room code or link to invite.</div>
        </div>

        <div className="card">
          <h3 className="section-title">Game setup</h3>
          {isHost ? (
            <>
              <ThemePicker
                themes={themes}
                value={themeId}
                onChange={(id) => configure({ themeId: id, undercoverCount })}
              />
              <div className="field field-inline" style={{ marginTop: 16 }}>
                <span>Undercover count</span>
                <div className="chips">
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`chip ${undercoverCount === n ? 'chip-active' : ''}`}
                      disabled={n >= nPlayers}
                      onClick={() => configure({ themeId, undercoverCount: n })}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="hint" style={{ marginTop: 12 }}>
                Suggested for {nPlayers} players: {defaultUC} undercover.
              </div>
              <button
                className="btn btn-primary btn-lg full"
                disabled={!canStart}
                onClick={startGame}
                style={{ marginTop: 20 }}
              >
                Start game
              </button>
              {!themeId && <div className="hint">Pick a theme to enable start.</div>}
              {nPlayers < 3 && <div className="hint">Waiting for at least 3 players…</div>}
            </>
          ) : (
            <>
              <div className="hint">Waiting for the host to configure and start the game.</div>
              {themeId && (
                <div style={{ marginTop: 12 }}>
                  <div className="eyebrow">Theme</div>
                  <div className="value">{room.config.themeName}</div>
                </div>
              )}
              <div style={{ marginTop: 12 }}>
                <div className="eyebrow">Undercovers</div>
                <div className="value">{undercoverCount}</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
