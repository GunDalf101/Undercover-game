import React, { useEffect } from 'react';
import { StateProvider, useGame } from './state.jsx';
import Home from './pages/Home.jsx';
import Lobby from './pages/Lobby.jsx';
import Game from './pages/Game.jsx';
import Results from './pages/Results.jsx';

function Shell() {
  const { state, leaveRoom } = useGame();
  const { session, room, connected, wasKicked } = state;

  // Deep-link support: /r/CODE prefills join.
  useEffect(() => {
    const path = window.location.pathname;
    const m = path.match(/^\/r\/([A-Za-z0-9]+)/);
    if (m) {
      const code = m[1].toUpperCase();
      sessionStorage.setItem('undercover-pending-code', code);
      window.history.replaceState({}, '', '/');
    }
  }, []);

  let content;
  if (!session || !room) {
    content = <Home />;
  } else if (room.phase === 'lobby') {
    content = <Lobby />;
  } else if (room.phase === 'ended') {
    content = <Results />;
  } else {
    content = <Game />;
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="logo">🕵️</span>
          <span className="brand-name">Undercover</span>
        </div>
        <div className="header-right">
          {!connected && <span className="pill offline">Reconnecting…</span>}
          {session && room && (
            <button className="link-btn" onClick={leaveRoom}>Leave room</button>
          )}
        </div>
      </header>
      {wasKicked && (
        <div className="banner banner-warn">You were removed from the room.</div>
      )}
      <main className="main">{content}</main>
      <footer className="footer">
        <small>Made for parties · no accounts · room codes only</small>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <StateProvider>
      <Shell />
    </StateProvider>
  );
}
