import {
  connectBus,
  playLockIn,
  playMiss,
  playerId,
  publish,
  queryParam,
  reasonText,
  siteUrl,
  teamLabel,
  topicsFor,
} from './shared.js';

const params = new URLSearchParams(window.location.search);
const code = (params.get('code') || queryParam('room')).toUpperCase();
const name = params.get('name') || '';
const team = params.get('team') || 'red';
const myId = playerId();
const topics = topicsFor(code);

function init() {
  if (!code || !name) {
    window.location.replace(siteUrl('', { room: code }).href);
    return;
  }

  const root = document.querySelector('#play-root');
  const nameEl = document.querySelector('#play-name');
  const teamEl = document.querySelector('#play-team');
  const buzzBtn = document.querySelector('#buzz-btn');
  const buzzLabel = document.querySelector('#buzz-label');
  const message = document.querySelector('#play-message');

  let client;
  let buzzing = false;
  let lastStatus = null;
  let joined = false;

  root.dataset.team = team;
  nameEl.textContent = name;
  teamEl.textContent = `${teamLabel(team)} team`;

  function setMessage(text) {
    message.textContent = text;
  }

  function render(state) {
    if (!state) return;
    root.dataset.mode = state.status;
    const iWon = state.winner && state.winner.playerId === myId;

    if (state.status === 'standby') {
      buzzBtn.disabled = true;
      buzzLabel.textContent = 'Wait';
      setMessage('Waiting for your teacher to open the buzzers.');
      return;
    }

    if (state.status === 'open') {
      buzzBtn.disabled = false;
      buzzLabel.textContent = 'BUZZ';
      setMessage('Press the button or the spacebar.');
      return;
    }

    buzzBtn.disabled = true;
    if (iWon) {
      buzzLabel.textContent = 'FIRST';
      setMessage(`Your team locked it in. ${teamLabel(state.winner.team)} is first.`);
    } else if (state.winner) {
      buzzLabel.textContent = 'LATE';
      setMessage(`${teamLabel(state.winner.team)} was first (${state.winner.name}).`);
    }
  }

  function sendJoin() {
    if (!client?.isConnected()) return;
    publish(client, topics.toHost, { type: 'join', playerId: myId, name, team });
    joined = true;
  }

  function buzz() {
    if (buzzBtn.disabled || buzzing || !client?.isConnected()) return;
    buzzing = true;
    if (navigator.vibrate) navigator.vibrate(40);
    publish(client, topics.toHost, { type: 'buzz', playerId: myId });
    window.setTimeout(() => {
      buzzing = false;
    }, 250);
  }

  buzzBtn.addEventListener('click', buzz);
  document.addEventListener('keydown', (event) => {
    if (event.code === 'Space' || event.code === 'Enter') {
      event.preventDefault();
      buzz();
    }
  });

  const timeout = window.setTimeout(() => {
    if (!joined) setMessage(reasonText('not-found'));
  }, 8000);

  client = connectBus({
    clientId: `player-${myId}`,
    will: { topic: topics.toHost, payload: { type: 'leave', playerId: myId } },
    onMessage: (_topic, state) => {
      window.clearTimeout(timeout);
      if (lastStatus === 'open' && state.status === 'locked' && state.winner?.playerId !== myId) {
        playMiss();
      }
      if (lastStatus !== 'locked' && state.status === 'locked' && state.winner?.playerId === myId) {
        playLockIn();
      }
      lastStatus = state.status;
      render(state);
    },
    onConnect: (connected) => {
      client = connected;
      connected.subscribe(topics.state);
      sendJoin();
      setMessage('Connected. Waiting for your teacher…');
    },
    onFail: () => {
      buzzBtn.disabled = true;
      buzzLabel.textContent = 'Error';
      setMessage(reasonText('offline'));
    },
  });
}

init();
