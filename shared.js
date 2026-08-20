const TEAMS = [
  { id: 'red', label: 'Red' },
  { id: 'blue', label: 'Blue' },
  { id: 'green', label: 'Green' },
  { id: 'yellow', label: 'Yellow' },
];

const REASONS = {
  'not-found': 'That room was not found. Keep the teacher screen open and check the four-letter code.',
  unauthorized: 'This teacher link is not valid. Start a new game from the home page.',
  'name-required': 'Please enter your name.',
  'invalid-team': 'Pick one of the four team colors.',
  'room-full': 'This room is full.',
  standby: 'Wait for your teacher to open the buzzers.',
  'too-late': 'Another team already buzzed.',
  'already-buzzed': 'You already buzzed this round.',
  'not-in-room': 'Join a team before buzzing.',
  'missing-player': 'Could not join. Refresh and try again.',
  offline: 'Could not connect. Check school Wi-Fi, then refresh.',
};

const BROKER = { host: 'broker.emqx.io', port: 8084, path: '/mqtt' };

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

export function siteBase() {
  const { pathname } = window.location;
  if (pathname.endsWith('/')) return pathname;
  const file = pathname.split('/').pop();
  if (file.includes('.')) return pathname.slice(0, pathname.lastIndexOf('/') + 1);
  return `${pathname}/`;
}

export function siteUrl(page = '', params) {
  const url = new URL(page, `${window.location.origin}${siteBase()}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== '') url.searchParams.set(key, String(value));
    }
  }
  return url;
}

export function joinUrl(code) {
  return siteUrl('', { room: code }).toString();
}

export function topicRoot(code) {
  const site = `${window.location.host}${siteBase()}`.replace(/[^a-zA-Z0-9._-]+/g, '_');
  return `edu/classbuzz/${site}/${code}`;
}

export function topicsFor(code) {
  const root = topicRoot(code);
  return { state: `${root}/state`, toHost: `${root}/to-host` };
}

export function playerId() {
  const key = 'classroom-buzzer-player';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

function paho() {
  return window.Paho.MQTT || window.Paho;
}

export function connectBus({ clientId, will, onMessage, onConnect, onFail }) {
  const { Client, Message } = paho();
  const client = new Client(`wss://${BROKER.host}:${BROKER.port}${BROKER.path}`, clientId);
  client.onMessageArrived = (message) => {
    try {
      onMessage(message.destinationName, JSON.parse(message.payloadString));
    } catch {
      // ignore malformed payloads
    }
  };
  client.onConnectionLost = (error) => {
    if (error.errorCode !== 0) onFail?.(error.errorMessage || 'Disconnected');
  };

  const options = {
    useSSL: true,
    timeout: 8,
    keepAliveInterval: 30,
    reconnect: true,
    mqttVersion: 4,
    onSuccess: () => onConnect(client),
    onFailure: (error) => onFail?.(error.errorMessage || 'Could not connect'),
  };

  if (will) {
    const message = new Message(JSON.stringify(will.payload));
    message.destinationName = will.topic;
    message.qos = 1;
    options.willMessage = message;
  }

  client.connect(options);
  return client;
}

export function publish(client, topic, payload, { retain = false } = {}) {
  const { Message } = paho();
  const message = new Message(JSON.stringify(payload));
  message.destinationName = topic;
  message.qos = 1;
  message.retained = retain;
  client.send(message);
}

export function makeQrDataUrl(text) {
  const qr = window.qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createDataURL(6, 2);
}

let audioContext;

function context() {
  if (!audioContext) audioContext = new AudioContext();
  if (audioContext.state === 'suspended') audioContext.resume();
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
