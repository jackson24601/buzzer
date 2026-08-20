import { playLockIn, playOpen, queryParam, reasonText, socket, teamLabel } from './shared.js';

const code = queryParam('code').toUpperCase();
const token = queryParam('token');
const ioClient = socket();

const roomCodeEl = document.querySelector('#room-code-display');
const joinUrlEl = document.querySelector('#join-url');
const qrImage = document.querySelector('#qr-image');
const statusBanner = document.querySelector('#status-banner');
const statusKicker = document.querySelector('#status-kicker');
const statusTitle = document.querySelector('#status-title');
const statusDetail = document.querySelector('#status-detail');
const statusLabel = document.querySelector('#host-status-label');
const teamsEl = document.querySelector('#teams');
const openBtn = document.querySelector('#open-btn');
const nextBtn = document.querySelector('#next-btn');
const standbyBtn = document.querySelector('#standby-btn');

let lastStatus = null;
let state = null;

roomCodeEl.textContent = code || '————';
joinUrlEl.textContent = `${window.location.origin}/?room=${code}`;
qrImage.src = `/api/qr/${encodeURIComponent(code)}`;

function renderTeams(nextState) {
  teamsEl.innerHTML = '';
  for (const team of nextState.teams) {
    const card = document.createElement('article');
    card.className = 'team-card';
    card.dataset.team = team.id;
    const rank = nextState.teamOrder.findIndex((entry) => entry.team === team.id);
    const title = document.createElement('h2');
    title.textContent = rank >= 0 ? `${rank + 1}. ${team.label}` : team.label;
    const list = document.createElement('ul');
    if (team.members.length === 0) {
      const empty = document.createElement('li');
      empty.textContent = 'No one yet';
      list.appendChild(empty);
    } else {
      for (const member of team.members) {
        const item = document.createElement('li');
        item.textContent = member.name;
        list.appendChild(item);
      }
    }
    card.append(title, list);
    teamsEl.appendChild(card);
  }
}

function render(nextState) {
  state = nextState;
  const count = nextState.players.length;
  statusLabel.textContent = `${count} student${count === 1 ? '' : 's'} connected`;
  statusBanner.dataset.status = nextState.status;
  statusBanner.dataset.team = nextState.winner?.team || '';

  if (nextState.status === 'standby') {
    statusKicker.textContent = 'Stand by';
    statusTitle.textContent = 'Read the question, then open the buzzers.';
    statusDetail.textContent = 'Students can join now. Nobody can buzz until you press Open.';
  } else if (nextState.status === 'open') {
    statusKicker.textContent = 'Live';
    statusTitle.textContent = 'Listening for the first team…';
    statusDetail.textContent = 'The first color to press locks in the round.';
  } else if (nextState.winner) {
    statusKicker.textContent = 'First team';
    statusTitle.textContent = `${teamLabel(nextState.winner.team)}!`;
    const others = nextState.teamOrder.slice(1).map((entry) => teamLabel(entry.team));
    statusDetail.textContent = others.length
      ? `${nextState.winner.name} got there first. Then: ${others.join(', ')}.`
      : `${nextState.winner.name} got there first.`;
  }

  renderTeams(nextState);
  openBtn.disabled = nextState.status === 'open';
  standbyBtn.disabled = nextState.status === 'standby';
}

function hostAction(eventName, extra = {}) {
  ioClient.emit(eventName, { token, ...extra }, (result) => {
    if (result && result.ok === false) {
      statusDetail.textContent = reasonText(result.reason);
    }
  });
}

openBtn.addEventListener('click', () => hostAction('host:open'));
standbyBtn.addEventListener('click', () => hostAction('host:standby'));
nextBtn.addEventListener('click', () => hostAction('host:reset', { open: false }));

document.addEventListener('keydown', (event) => {
  if (event.target.matches('input, textarea')) return;
  if (event.code === 'Space') {
    event.preventDefault();
    if (state?.status !== 'open') hostAction('host:open');
  }
  if (event.key === 'n' || event.key === 'N' || event.key === 'r' || event.key === 'R') {
    hostAction('host:reset', { open: false });
  }
});

ioClient.on('state', (nextState) => {
  if (lastStatus !== 'locked' && nextState.status === 'locked') playLockIn();
  if (lastStatus !== 'open' && nextState.status === 'open') playOpen();
  lastStatus = nextState.status;
  render(nextState);
});

ioClient.emit('host:join', { code, token }, (result) => {
  if (!result?.ok) {
    statusKicker.textContent = 'Host link problem';
    statusTitle.textContent = 'Could not open this game.';
    statusDetail.textContent = reasonText(result?.reason);
    return;
  }
  lastStatus = result.state.status;
  render(result.state);
});
