import React, { useEffect, useState } from 'react';
import { useGame } from '../state.jsx';

export default function Home() {
  const { createRoom, joinRoom } = useGame();
  const [mode, setMode] = useState('choose'); // 'choose' | 'host' | 'join'
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const pending = sessionStorage.getItem('undercover-pending-code');
    if (pending) {
      setRoomCode(pending);
      setMode('join');
      sessionStorage.removeItem('undercover-pending-code');
    }
  }, []);

  const validName = nickname.trim().length >= 2;

  async function onHost(e) {
    e.preventDefault();
    if (!validName) return;
    setBusy(true);
    setError('');
    const res = await createRoom(nickname.trim());
    setBusy(false);
    if (!res || !res.ok) setError(res?.error || 'Could not create room');
  }

  async function onJoin(e) {
    e.preventDefault();
    if (!validName) return;
    const code = roomCode.trim().toUpperCase();
    if (code.length < 4) {
      setError('Enter a valid room code');
      return;
    }
    setBusy(true);
    setError('');
    const res = await joinRoom(code, nickname.trim());
    setBusy(false);
    if (!res || !res.ok) setError(res?.error || 'Could not join room');
  }

  if (mode === 'choose') {
    return (
      <div className="card home-hero">
        <h1 className="title">Party of spies</h1>
        <p className="subtitle">
          Most players get the same secret word. One or two get a similar impostor word.
          Describe it — try not to sound suspicious — then vote out the undercover.
        </p>
        <div className="cta-row">
          <button className="btn btn-primary btn-lg" onClick={() => setMode('host')}>
            Host a room
          </button>
          <button className="btn btn-secondary btn-lg" onClick={() => setMode('join')}>
            Join a room
          </button>
        </div>
        <div className="hint">3–20 players · no accounts · works on phones</div>
      </div>
    );
  }

  return (
    <div className="card">
      <button className="link-btn back" onClick={() => setMode('choose')}>← Back</button>
      <h2 className="title">{mode === 'host' ? 'Host a new room' : 'Join a room'}</h2>
      <form onSubmit={mode === 'host' ? onHost : onJoin} className="stack">
        {mode === 'join' && (
          <label className="field">
            <span>Room code</span>
            <input
              className="input mono uppercase"
              maxLength={8}
              value={roomCode}
              autoCapitalize="characters"
              onChange={(e) => setRoomCode(e.target.value.replace(/[^A-Za-z0-9]/g, ''))}
              placeholder="ABC123"
              autoFocus
            />
          </label>
        )}
        <label className="field">
          <span>Your nickname</span>
          <input
            className="input"
            maxLength={20}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="e.g. Alex"
            autoFocus={mode === 'host'}
          />
        </label>
        {error && <div className="banner banner-warn">{error}</div>}
        <button className="btn btn-primary btn-lg" type="submit" disabled={!validName || busy}>
          {busy ? 'Working…' : mode === 'host' ? 'Create room' : 'Join'}
        </button>
      </form>
    </div>
  );
}
