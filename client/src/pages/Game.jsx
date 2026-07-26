import React, { useEffect, useState } from 'react';
import { useGame } from '../state.jsx';
import WordCard from '../components/WordCard.jsx';
import PlayerList from '../components/PlayerList.jsx';
import VotePanel from '../components/VotePanel.jsx';

export default function Game() {
  const { state, startDescribing, startVoting, castVote, forceTally, nextRound, kick } = useGame();
  const { room, session, myWord, lastElimination, runoff } = state;

  const me = room.players.find((p) => p.id === session.playerId);
  const isHost = me?.isHost;
  const alive = me?.alive;

  // Local flag: player has looked at their own word in reveal phase
  const [wordSeen, setWordSeen] = useState(false);
  useEffect(() => {
    // reset when round changes
    setWordSeen(false);
  }, [room.round]);

  const speakingList = room.speakingOrder
    .map((pid) => room.players.find((p) => p.id === pid))
    .filter(Boolean);

  return (
    <div className="game">
      <div className="row space-between wrap gap">
        <div>
          <div className="eyebrow">Round</div>
          <div className="value">{room.round}</div>
        </div>
        <div>
          <div className="eyebrow">Theme</div>
          <div className="value">{room.config.themeName}</div>
        </div>
        <div>
          <div className="eyebrow">Alive</div>
          <div className="value">
            {room.players.filter((p) => p.alive).length}/{room.players.length}
          </div>
        </div>
        <div>
          <div className="eyebrow">Phase</div>
          <div className="value cap">{room.phase}</div>
        </div>
      </div>

      {lastElimination && (room.phase === 'resolution' || room.phase === 'describe') && (
        <div className="banner banner-info">
          <strong>{lastElimination.nickname}</strong> was eliminated —
          they were <em>{lastElimination.role === 'undercover' ? 'the Undercover' : 'a Civilian'}</em>.
        </div>
      )}

      {room.phase === 'reveal' && (
        <div className="card centered">
          {alive ? (
            <>
              <div className="eyebrow">Your secret word</div>
              <WordCard word={myWord?.word} revealed={wordSeen} onReveal={() => setWordSeen(true)} />
              <div className="hint">Only you can see this. Memorize it — don't say it out loud.</div>
            </>
          ) : (
            <div className="hint">You're spectating. A new game will let you play again.</div>
          )}
          {isHost && (
            <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={startDescribing}>
              Start describing
            </button>
          )}
          {!isHost && <div className="hint" style={{ marginTop: 16 }}>Waiting for the host to start the round…</div>}
        </div>
      )}

      {room.phase === 'describe' && (
        <>
          <div className="card">
            {alive && myWord?.word && (
              <>
                <div className="eyebrow">Your secret word</div>
                <div className="word-inline">{myWord.word}</div>
              </>
            )}
            {!alive && <div className="hint">You've been eliminated — spectate quietly.</div>}
          </div>
          <div className="card">
            <h3 className="section-title">Speaking order</h3>
            <ol className="speaker-list">
              {speakingList.map((p) => (
                <li key={p.id} className={p.alive ? '' : 'dim'}>
                  {p.nickname}{p.id === session.playerId ? ' (you)' : ''}{!p.alive ? ' — eliminated' : ''}
                </li>
              ))}
            </ol>
            <div className="hint">Give a one-sentence clue about your word without saying it directly.</div>
            {isHost && (
              <button className="btn btn-primary full" style={{ marginTop: 16 }} onClick={startVoting}>
                Start voting
              </button>
            )}
          </div>
        </>
      )}

      {room.phase === 'vote' && (
        <>
          {alive && myWord?.word && (
            <div className="card">
              <div className="eyebrow">Your secret word</div>
              <div className="word-inline">{myWord.word}</div>
            </div>
          )}
          <VotePanel
            players={room.players}
            meId={session.playerId}
            alive={!!alive}
            runoffCandidates={runoff?.candidates || room.runoffCandidates}
            votesReceived={room.votesReceived}
            onVote={castVote}
            isHost={isHost}
            onForceTally={forceTally}
          />
        </>
      )}

      {room.phase === 'resolution' && (
        <div className="card centered">
          <h3 className="section-title">Round complete</h3>
          <div className="hint">
            {lastElimination
              ? `${lastElimination.nickname} was voted out.`
              : 'No one was eliminated this round.'}
          </div>
          {isHost ? (
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={nextRound}>
              Start next round
            </button>
          ) : (
            <div className="hint" style={{ marginTop: 12 }}>Waiting for the host to continue…</div>
          )}
        </div>
      )}

      <div className="card">
        <h3 className="section-title">Players</h3>
        <PlayerList
          players={room.players}
          hostId={room.hostId}
          meId={session.playerId}
          canKick={isHost && (room.phase === 'reveal' || room.phase === 'describe')}
          onKick={kick}
        />
      </div>
    </div>
  );
}
