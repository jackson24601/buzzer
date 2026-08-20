import { createSession } from './lib/session.js';
import { randomCode } from './lib/game.js';
import {
  connectBus,
  joinUrl,
  makeQrDataUrl,
  playLockIn,
  playOpen,
  publish,
  queryParam,
  reasonText,
  siteUrl,
  teamLabel,
  topicsFor,
} from './shared.js';

let code = queryParam('code').toUpperCase();
let token = queryParam('token');

if (!code || !token) {
  code = randomCode();
  token = crypto.randomUUID();
  history.replaceState({}, '', siteUrl('host.html', { code, token }).href);
}

const session = createSession(code, token);
const topics = topicsFor(code);
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

let lastStatus = session.getState().status;
let state = session.getState();
let client;

const shareUrl = joinUrl(code);
roomCodeEl.textContent = code;
joinUrlEl.textContent = shareUrl;
qrImage.src = makeQrDataUrl(shareUrl);

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
    statusDetail.textContent = 'Keep this tab open. Students can join now; nobody can buzz until you press Open.';
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

function publishState() {
  const nextState = session.getState();
  if (lastStatus !== 'locked' && nextState.status === 'locked') playLockIn();
  if (lastStatus !== 'open' && nextState.status === 'open') playOpen();
  lastStatus = nextState.status;
  render(nextState);
  if (client?.isConnected()) publish(client, topics.state, nextState, { retain: true });
}

function handleHostMessage(_topic, message) {
  if (message.type === 'join') {
    session.join(message.playerId, message.name, message.team);
    publishState();
  } else if (message.type === 'buzz') {
    session.buzz(message.playerId);
    publishState();
  } else if (message.type === 'leave') {
    session.leave(message.playerId);
    publishState();
  }
}

function hostAction(action) {
  const result = session[action](token);
  if (result.ok === false) {
    statusDetail.textContent = reasonText(result.reason);
    return;
  }
  publishState();
}

openBtn.addEventListener('click', () => hostAction('open'));
standbyBtn.addEventListener('click', () => hostAction('standby'));
nextBtn.addEventListener('click', () => hostAction('reset'));

document.addEventListener('keydown', (event) => {
  if (event.target.matches('input, textarea')) return;
  if (event.code === 'Space') {
    event.preventDefault();
    if (state?.status !== 'open') hostAction('open');
  }
  if (event.key === 'n' || event.key === 'N' || event.key === 'r' || event.key === 'R') {
    hostAction('reset');
  }
});

render(session.getState());

client = connectBus({
  clientId: `host-${code}-${crypto.randomUUID().slice(0, 8)}`,
  onMessage: handleHostMessage,
  onConnect: (connected) => {
    client = connected;
    connected.subscribe(topics.toHost);
    publishState();
    statusLabel.textContent = 'Waiting for students…';
  },
  onFail: (error) => {
    statusKicker.textContent = 'Connection problem';
    statusTitle.textContent = 'Could not start the live buzzer.';
    statusDetail.textContent = error || reasonText('offline');
  },
});
