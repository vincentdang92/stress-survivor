/** SFX.js — Web Audio synth sound effects */

let AC = null;
let muted = false;
const lastSnd = {};

export function initAudio() {
  if (!AC) {
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { }
  }
  if (AC && AC.state === 'suspended') AC.resume();
}

export function setMuted(v) { muted = v; }
export function getMuted() { return muted; }

function gate(key, gap) {
  if (!key) return true;
  const n = AC.currentTime;
  if (lastSnd[key] && n - lastSnd[key] < gap) return false;
  lastSnd[key] = n;
  return true;
}

function tone(type, f1, f2, dur, vol, key, gap = 0.03) {
  if (!AC || muted || !gate(key, gap)) return;
  const now = AC.currentTime;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f1, now);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), now + dur);
  g.gain.setValueAtTime(vol, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  o.connect(g).connect(AC.destination);
  o.start(now); o.stop(now + dur + 0.02);
}

let noiseBuf = null;
function noise(dur, vol, freq = 1200, key, gap = 0.05) {
  if (!AC || muted || !gate(key, gap)) return;
  const now = AC.currentTime;
  if (!noiseBuf) {
    noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = AC.createBufferSource(); s.buffer = noiseBuf;
  const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = AC.createGain(); g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  s.connect(f).connect(g).connect(AC.destination); s.start(now); s.stop(now + dur);
}

export const SFX = {
  shoot:    () => tone('square', 900, 500, 0.04, 0.018, 'shoot', 0.07),
  hit:      () => tone('triangle', 320, 140, 0.05, 0.04, 'hit', 0.035),
  kill:     () => tone('square', 520, 1100, 0.06, 0.035, 'kill', 0.04),
  hurt:     () => { tone('sawtooth', 170, 60, 0.22, 0.12, 'hurt', 0.1); noise(0.15, 0.1, 700); },
  boom:     () => noise(0.35, 0.2, 900, 'boom', 0.08),
  level:    () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone('triangle', f, f, 0.14, 0.07), i * 70)),
  rage:     () => { tone('sawtooth', 100, 38, 0.9, 0.18); noise(0.8, 0.28, 500); },
  pick:     () => tone('sine', 1200, 1900, 0.06, 0.03, 'pick', 0.03),
  dash:     () => noise(0.12, 0.08, 3200, 'dash', 0.1),
  zap:      () => tone('sawtooth', 1500, 300, 0.12, 0.045, 'zap', 0.06),
  bossShot: () => tone('square', 220, 160, 0.15, 0.05, 'bs', 0.1),
  tap:      () => tone('triangle', 800, 400, 0.04, 0.025, 'tap', 0.03),
  combo:    () => tone('sine', 1100, 1600, 0.06, 0.04, 'combo', 0.1),
  win:      () => [784, 988, 1175, 1568].forEach((f, i) => setTimeout(() => tone('triangle', f, f * 1.05, 0.3, 0.08), i * 120)),
  lose:     () => [400, 300, 200].forEach((f, i) => setTimeout(() => tone('sawtooth', f, f * 0.5, 0.35, 0.1), i * 200)),
};
