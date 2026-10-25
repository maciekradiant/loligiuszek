// The caller (spoken scores via the phone's Polish voice) and small synthesized sound effects.

let voice = null;
let ctx = null;

function pickVoice() {
  if (!('speechSynthesis' in window)) return null;
  const voices = speechSynthesis.getVoices();
  return voices.find((v) => v.lang === 'pl-PL' && /zosia|ewa|premium|enhanced/i.test(v.name)) || voices.find((v) => v.lang?.startsWith('pl')) || null;
}

if ('speechSynthesis' in window) {
  voice = pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', () => (voice = pickVoice()));
}

export function say(text, { rate = 1.02, pitch = 1, interrupt = true } = {}) {
  try {
    if (!('speechSynthesis' in window)) return;
    if (interrupt) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pl-PL';
    if (voice) u.voice = voice;
    u.rate = rate;
    u.pitch = pitch;
    speechSynthesis.speak(u);
  } catch {
    /* no voice available */
  }
}

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// A short dull thud, like a dart going into sisal.
export function thud(strength = 1) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const len = 0.09;
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * len), ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900 + 500 * strength;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.5 * strength, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + len);
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(t);
}

// Two balls kissing: a short bright click with a quick decay.
export function clack() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  for (const [freq, at] of [
    [2400, 0],
    [1800, 0.012],
  ]) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t + at);
    gain.gain.setValueAtTime(0.25, t + at);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.06);
    osc.connect(gain).connect(ac.destination);
    osc.start(t + at);
    osc.stop(t + at + 0.08);
  }
}

function tone(freq, start, dur, type = 'triangle', vol = 0.18) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + start;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

export function chime(kind) {
  if (kind === 'bust') {
    tone(220, 0, 0.18, 'sawtooth', 0.08);
    tone(165, 0.12, 0.28, 'sawtooth', 0.08);
  } else if (kind === 'big') {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.07, 0.4));
  } else if (kind === 'win') {
    [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.09, 0.6, 'triangle', 0.16));
  } else {
    tone(660, 0, 0.12, 'sine', 0.1);
  }
}

// Unlock audio on the first touch (iOS keeps it muted until a gesture).
export function unlock() {
  audio();
  try {
    if ('speechSynthesis' in window && !speechSynthesis.speaking) speechSynthesis.getVoices();
  } catch {
    /* ignore */
  }
}
