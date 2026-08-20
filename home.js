import { randomCode } from './lib/game.js';
import { TEAMS, queryParam, reasonText, siteUrl } from './shared.js';

const homeMain = document.querySelector('#home-main');
const joinMain = document.querySelector('#join-main');
const colorGrid = document.querySelector('#color-grid');
const joinForm = document.querySelector('#join-form');
const joinError = document.querySelector('#join-error');
const codeInput = document.querySelector('#room-code');
const nameInput = document.querySelector('#student-name');

let selectedTeam = 'red';

function showJoin(code = '') {
  homeMain.classList.add('hidden');
  joinMain.classList.remove('hidden');
  if (code) codeInput.value = code.toUpperCase();
  nameInput.focus();
}

function renderColors() {
  colorGrid.innerHTML = '';
  for (const team of TEAMS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'color-option';
    button.dataset.team = team.id;
    button.textContent = team.label;
    button.setAttribute('aria-pressed', team.id === selectedTeam ? 'true' : 'false');
    button.addEventListener('click', () => {
      selectedTeam = team.id;
      renderColors();
    });
    colorGrid.appendChild(button);
  }
}

document.querySelector('#student-btn').addEventListener('click', () => showJoin(queryParam('room')));

document.querySelector('#teacher-btn').addEventListener('click', () => {
  window.location.href = siteUrl('host.html', {
    code: randomCode(),
    token: crypto.randomUUID(),
  }).href;
});

joinForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const code = codeInput.value.trim().toUpperCase();
  const name = nameInput.value.trim();
  if (!code || !name) {
    joinError.textContent = reasonText('name-required');
    joinError.classList.remove('hidden');
    return;
  }
  window.location.href = siteUrl('play.html', { code, name, team: selectedTeam }).href;
});

codeInput.addEventListener('input', () => {
  codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
});

renderColors();

const preset = queryParam('room');
if (preset) showJoin(preset);
