import { playLockIn, playMiss, queryParam, reasonText, socket, teamLabel } from './shared.js';

const params = new URLSearchParams(window.location.search);
const code = (params.get('code') || queryParam('room')).toUpperCase();
const name = params.get('name') || '';
const team = params.get('team') || 'red';

function init() {
  if (!code || !name) {
    window.location.replace(`/?room=${encodeURIComponent(code)}`);
    return;
  }

  const ioClient = socket();
  const root = document.querySelector('#play-root');
  const nameEl = document.querySelector('#play-name');
  const teamEl = document.querySelector('#play-team');
  const buzzBtn = document.querySelector('#buzz-btn');
  const buzzLabel = document.querySelector('#buzz-label');
  const message = document.querySelector('#play-message');

  let myId = null;
  let buzzing = false;
  let lastStatus = null;

  root.dataset.team = team;
  nameEl.textContent = name;
  teamEl.textContent = `${teamLabel(team)} team`;

  function setMessage(text) {
    message.textContent = text;
  }

  function render(state) {
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

  function buzz() {
    if (buzzBtn.disabled || buzzing) return;
    buzzing = true;
    if (navigator.vibrate) navigator.vibrate(40);
    ioClient.emit('player:buzz', (result) => {
      buzzing = false;
      if (!result?.ok) {
        setMessage(reasonText(result?.reason));
        return;
      }
      if (result.first) playLockIn();
      else playMiss();
    });
  }

  buzzBtn.addEventListener('click', buzz);
  document.addEventListener('keydown', (event) => {
    if (event.code === 'Space' || event.code === 'Enter') {
      event.preventDefault();
      buzz();
    }
  });

  ioClient.on('state', (state) => {
    if (lastStatus === 'open' && state.status === 'locked' && state.winner?.playerId !== myId) {
      playMiss();
    }
    lastStatus = state.status;
    render(state);
  });

  ioClient.emit('player:join', { code, name, team }, (result) => {
    if (!result?.ok) {
      setMessage(reasonText(result?.reason));
      buzzBtn.disabled = true;
      buzzLabel.textContent = 'Error';
      return;
    }
    myId = result.player.id;
    lastStatus = result.state.status;
    root.dataset.team = result.player.team;
    nameEl.textContent = result.player.name;
    teamEl.textContent = `${teamLabel(result.player.team)} team`;
    render(result.state);
  });
}

init();
