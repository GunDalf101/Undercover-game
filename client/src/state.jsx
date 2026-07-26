import { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
import socket from './socket.js';

const SESSION_KEY = 'undercover-session';

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function saveSession(session) {
  if (!session) sessionStorage.removeItem(SESSION_KEY);
  else sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

const initialState = {
  connected: false,
  session: loadSession(),
  room: null,
  themes: [],
  myWord: null,
  lastElimination: null,
  runoff: null,
  ended: null,
  wasKicked: false,
  error: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'connected':
      return { ...state, connected: action.value };
    case 'session':
      saveSession(action.value);
      return { ...state, session: action.value };
    case 'room':
      return { ...state, room: action.value };
    case 'themes':
      return { ...state, themes: action.value };
    case 'myWord':
      return { ...state, myWord: action.value };
    case 'eliminated':
      return { ...state, lastElimination: action.value };
    case 'runoff':
      return { ...state, runoff: action.value };
    case 'ended':
      return { ...state, ended: action.value };
    case 'kicked':
      saveSession(null);
      return { ...initialState, session: null, wasKicked: true, connected: state.connected };
    case 'clearSession':
      saveSession(null);
      return { ...initialState, session: null, connected: state.connected };
    case 'error':
      return { ...state, error: action.value };
    case 'resetEphemeral':
      return { ...state, myWord: null, lastElimination: null, runoff: null, ended: null };
    default:
      return state;
  }
}

const StateCtx = createContext(null);

export function StateProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const onConnect = () => {
      dispatch({ type: 'connected', value: true });
      socket.emit('theme:list', (list) => dispatch({ type: 'themes', value: list || [] }));
      const s = loadSession();
      if (s && s.roomCode && s.playerId && s.token) {
        socket.emit(
          'room:join',
          { roomCode: s.roomCode, playerId: s.playerId, token: s.token, nickname: s.nickname },
          (res) => {
            if (res && res.ok) {
              dispatch({
                type: 'session',
                value: { roomCode: res.roomCode, playerId: res.playerId, token: res.token, nickname: s.nickname },
              });
              dispatch({ type: 'room', value: res.state });
              if (res.themes) dispatch({ type: 'themes', value: res.themes });
            } else {
              dispatch({ type: 'clearSession' });
            }
          },
        );
      }
    };
    const onDisconnect = () => dispatch({ type: 'connected', value: false });
    const onState = (r) => dispatch({ type: 'room', value: r });
    const onWord = (payload) => dispatch({ type: 'myWord', value: payload });
    const onElim = (elim) => dispatch({ type: 'eliminated', value: elim });
    const onRunoff = (r) => dispatch({ type: 'runoff', value: r });
    const onEnded = (e) => dispatch({ type: 'ended', value: e });
    const onKicked = () => dispatch({ type: 'kicked' });
    const onError = (e) => dispatch({ type: 'error', value: e });

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:state', onState);
    socket.on('you:word', onWord);
    socket.on('round:eliminated', onElim);
    socket.on('vote:runoff', onRunoff);
    socket.on('game:ended', onEnded);
    socket.on('room:kicked', onKicked);
    socket.on('error:msg', onError);

    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:state', onState);
      socket.off('you:word', onWord);
      socket.off('round:eliminated', onElim);
      socket.off('vote:runoff', onRunoff);
      socket.off('game:ended', onEnded);
      socket.off('room:kicked', onKicked);
      socket.off('error:msg', onError);
    };
  }, []);

  const createRoom = useCallback((nickname) => {
    return new Promise((resolve) => {
      socket.emit('room:create', { nickname }, (res) => {
        if (res && res.ok) {
          dispatch({
            type: 'session',
            value: { roomCode: res.roomCode, playerId: res.playerId, token: res.token, nickname },
          });
          dispatch({ type: 'room', value: res.state });
          if (res.themes) dispatch({ type: 'themes', value: res.themes });
        }
        resolve(res);
      });
    });
  }, []);

  const joinRoom = useCallback((roomCode, nickname) => {
    return new Promise((resolve) => {
      socket.emit('room:join', { roomCode: roomCode.toUpperCase(), nickname }, (res) => {
        if (res && res.ok) {
          dispatch({
            type: 'session',
            value: { roomCode: res.roomCode, playerId: res.playerId, token: res.token, nickname },
          });
          dispatch({ type: 'room', value: res.state });
          if (res.themes) dispatch({ type: 'themes', value: res.themes });
        }
        resolve(res);
      });
    });
  }, []);

  const leaveRoom = useCallback(() => {
    socket.emit('room:leave');
    dispatch({ type: 'clearSession' });
  }, []);

  const configure = useCallback((cfg) => {
    socket.emit('host:configure', cfg, () => {});
  }, []);
  const startGame = useCallback(() => socket.emit('host:startGame', {}, () => {}), []);
  const startDescribing = useCallback(() => socket.emit('host:startDescribing', {}, () => {}), []);
  const startVoting = useCallback(() => socket.emit('host:startVoting', {}, () => {}), []);
  const castVote = useCallback((targetPlayerId) => socket.emit('vote:cast', { targetPlayerId }, () => {}), []);
  const forceTally = useCallback(() => socket.emit('host:forceTally', {}, () => {}), []);
  const nextRound = useCallback(() => socket.emit('host:nextRound', {}, () => {}), []);
  const playAgain = useCallback(() => socket.emit('host:playAgain', {}, () => {}), []);
  const kick = useCallback((playerId) => socket.emit('host:kick', { playerId }, () => {}), []);

  const value = {
    state,
    dispatch,
    createRoom,
    joinRoom,
    leaveRoom,
    configure,
    startGame,
    startDescribing,
    startVoting,
    castVote,
    forceTally,
    nextRound,
    playAgain,
    kick,
  };

  return <StateCtx.Provider value={value}>{children}</StateCtx.Provider>;
}

export function useGame() {
  const ctx = useContext(StateCtx);
  if (!ctx) throw new Error('useGame must be used within StateProvider');
  return ctx;
}
