"use client";

let ctx = null;
let ready = false;
let noiseBuffer = null;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

function initNoiseBuffer() {
  if (noiseBuffer) return;
  const c = getCtx();
  const size = Math.ceil(c.sampleRate * 0.1); // 100ms of noise, reusable
  noiseBuffer = c.createBuffer(1, size, c.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
}

function playTone(freq, duration, volume = 0.15, type = "square") {
  if (!ready) return;
  try {
    const c = getCtx();
    if (c.state === "suspended") return; // don't queue on suspended context
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
  } catch (e) {
    console.warn('playTone failed:', e.message);
  }
}

function playNoise(duration, volume = 0.05) {
  if (!ready) return;
  try {
    const c = getCtx();
    if (c.state === "suspended") return;
    initNoiseBuffer();
    const source = c.createBufferSource();
    const gain = c.createGain();
    source.buffer = noiseBuffer;
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    source.connect(gain);
    gain.connect(c.destination);
    source.start(0, 0, duration);
  } catch (e) {
    console.warn('playNoise failed:', e.message);
  }
}

export const sounds = {
  async init() {
    try {
      const c = getCtx();
      if (c.state === "suspended") await c.resume();
      initNoiseBuffer();
      ready = true;
    } catch (e) {
      console.warn('Sound init failed:', e.message);
    }
  },
  shuffle() {
    for (let i = 0; i < 4; i++) {
      setTimeout(() => playNoise(0.06, 0.08), i * 60);
    }
  },
  deal() {
    playNoise(0.05, 0.08);
    playTone(800, 0.04, 0.06);
  },
  cardPlay() {
    playTone(440, 0.06, 0.12);
    playNoise(0.05, 0.07);
  },
  trickWon() {
    playTone(523, 0.1, 0.12);
    setTimeout(() => playTone(659, 0.1, 0.12), 60);
  },
  bidMade() {
    playTone(440, 0.1, 0.12);
    setTimeout(() => playTone(554, 0.1, 0.12), 80);
    setTimeout(() => playTone(659, 0.1, 0.12), 160);
  },
  bidPass() {
    playTone(220, 0.08, 0.08);
  },
  setBack() {
    playTone(440, 0.15, 0.14);
    setTimeout(() => playTone(330, 0.15, 0.14), 150);
    setTimeout(() => playTone(262, 0.2, 0.14), 300);
  },
  madeIt() {
    [523, 659, 784].forEach((f, i) => {
      setTimeout(() => playTone(f, 0.12, 0.14), i * 80);
    });
  },
  win() {
    if (!ready) return;
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => playTone(f, 0.18, 0.18), i * 120);
    });
  },
  lose() {
    playTone(131, 0.4, 0.18);
  },
  turn() {
    playTone(784, 0.08, 0.1);
  },
  hover() {
    playTone(523, 0.04, 0.04);
  },
};
