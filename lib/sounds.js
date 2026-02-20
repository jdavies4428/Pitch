"use client";

let ctx = null;
let ready = false;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

function playTone(freq, duration, volume = 0.15, type = "square") {
  if (!ready) return;
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + duration);
  } catch {}
}

function playNoise(duration, volume = 0.05) {
  if (!ready) return;
  try {
    const c = getCtx();
    const bufferSize = c.sampleRate * duration;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = c.createBufferSource();
    const gain = c.createGain();
    source.buffer = buffer;
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    source.connect(gain);
    gain.connect(c.destination);
    source.start();
  } catch {}
}

export const sounds = {
  async init() {
    if (ready) return;
    try {
      const c = getCtx();
      if (c.state === "suspended") await c.resume();
      ready = true;
    } catch {}
  },
  shuffle() {
    for (let i = 0; i < 4; i++) {
      setTimeout(() => playNoise(0.04, 0.06), i * 60);
    }
  },
  deal() {
    playNoise(0.03, 0.07);
    playTone(800, 0.02, 0.04);
  },
  cardPlay() {
    playTone(440, 0.04, 0.1);
    playNoise(0.03, 0.05);
  },
  trickWon() {
    playTone(523, 0.08, 0.1);
    setTimeout(() => playTone(659, 0.08, 0.1), 50);
  },
  bidMade() {
    playTone(440, 0.08, 0.1);
    setTimeout(() => playTone(554, 0.08, 0.1), 80);
    setTimeout(() => playTone(659, 0.08, 0.1), 160);
  },
  bidPass() {
    playTone(220, 0.06, 0.06);
  },
  setBack() {
    playTone(440, 0.15, 0.12);
    setTimeout(() => playTone(330, 0.15, 0.12), 150);
    setTimeout(() => playTone(262, 0.2, 0.12), 300);
  },
  madeIt() {
    [523, 659, 784].forEach((f, i) => {
      setTimeout(() => playTone(f, 0.1, 0.12), i * 80);
    });
  },
  win() {
    const c = getCtx();
    if (!c || !ready) return;
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => playTone(f, 0.15, 0.15), i * 120);
    });
  },
  lose() {
    playTone(131, 0.4, 0.15);
  },
  turn() {
    playTone(784, 0.06, 0.08);
  },
  hover() {
    playTone(523, 0.03, 0.03);
  },
};
