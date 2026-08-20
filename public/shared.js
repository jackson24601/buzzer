const TEAMS = [
  { id: 'red', label: 'Red' },
  { id: 'blue', label: 'Blue' },
  { id: 'green', label: 'Green' },
  { id: 'yellow', label: 'Yellow' },
];

const REASONS = {
  'not-found': 'That room code was not found. Check the four-letter code on the teacher screen.',
  unauthorized: 'This teacher link is not valid. Start a new game from the home page.',
  'name-required': 'Please enter your name.',
  'invalid-team': 'Pick one of the four team colors.',
  'room-full': 'This room is full.',
  standby: 'Wait for your teacher to open the buzzers.',
  'too-late': 'Another team already buzzed.',
  'already-buzzed': 'You already buzzed this round.',
  'not-in-room': 'Join a team before buzzing.',
  'missing-player': 'Could not join. Refresh and try again.',
};

export { TEAMS, REASONS };

export function teamLabel(id) {
  return TEAMS.find((team) => team.id === id)?.label || id;
}

export function queryParam(name) {
  return new URLSearchParams(window.location.search).get(name) || '';
}

export function reasonText(reason) {
  return REASONS[reason] || 'Something went wrong. Try again.';
}

let audioContext;

function context() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

export function playTone({ from, to, duration = 0.28, type = 'square', volume = 0.12 }) {
  const ctx = context();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, ctx.currentTime);
  if (to) {
    oscillator.frequency.exponentialRampToValueAtTime(to, ctx.currentTime + duration * 0.7);
  }
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + duration);
}

export function playLockIn() {
  playTone({ from: 220, to: 880, duration: 0.45, type: 'sawtooth', volume: 0.1 });
}

export function playMiss() {
  playTone({ from: 160, to: 90, duration: 0.25, type: 'triangle', volume: 0.08 });
}

export function playOpen() {
  playTone({ from: 520, to: 640, duration: 0.16, type: 'square', volume: 0.07 });
}

export function socket() {
  return window.io({
    transports: ['websocket', 'polling'],
  });
}
