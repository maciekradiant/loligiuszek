// Visual flourishes drawn on canvas: the dartboard emblem and the confetti burst.

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

// Draws a regulation-proportioned board (radii in mm: bull 6.35, outer bull 15.9, treble 99–107,
// double 162–170) with the number ring around it.
export function drawBoard(canvas, { numbers = true, highlight = null } = {}) {
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const size = canvas.clientWidth || 280;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const c = size / 2;
  const outer = numbers ? size * 0.4 : size * 0.48;
  const k = outer / 170;
  const col = {
    black: css('--board-black') || '#151311',
    cream: css('--board-cream') || '#e8dcbc',
    red: css('--red') || '#e2443a',
    green: css('--green') || '#2fae74',
    wire: css('--brass') || '#d9ac52',
    ink: css('--ink') || '#0e0d0b',
    text: css('--sisal') || '#f0e6cc',
  };
  g.clearRect(0, 0, size, size);
  if (numbers) {
    g.beginPath();
    g.arc(c, c, size * 0.495, 0, Math.PI * 2);
    g.fillStyle = col.black;
    g.fill();
  }
  const seg = (Math.PI * 2) / 20;
  const ring = (r0, r1, i, fill) => {
    const a0 = -Math.PI / 2 + (i - 0.5) * seg;
    g.beginPath();
    g.arc(c, c, r1 * k, a0, a0 + seg);
    g.arc(c, c, r0 * k, a0 + seg, a0, true);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  };
  ORDER.forEach((n, i) => {
    const even = i % 2 === 0;
    const hi = highlight === n;
    ring(15.9, 99, i, hi ? col.wire : even ? col.black : col.cream);
    ring(99, 107, i, even ? col.red : col.green);
    ring(107, 162, i, hi ? col.wire : even ? col.black : col.cream);
    ring(162, 170, i, even ? col.red : col.green);
  });
  g.beginPath();
  g.arc(c, c, 15.9 * k, 0, Math.PI * 2);
  g.fillStyle = col.green;
  g.fill();
  g.beginPath();
  g.arc(c, c, 6.35 * k, 0, Math.PI * 2);
  g.fillStyle = col.red;
  g.fill();
  // spider wire
  g.strokeStyle = col.wire;
  g.globalAlpha = 0.55;
  g.lineWidth = Math.max(0.6, size / 520);
  [15.9, 99, 107, 162, 170].forEach((r) => {
    g.beginPath();
    g.arc(c, c, r * k, 0, Math.PI * 2);
    g.stroke();
  });
  for (let i = 0; i < 20; i++) {
    const a = -Math.PI / 2 + (i - 0.5) * seg;
    g.beginPath();
    g.moveTo(c + Math.cos(a) * 15.9 * k, c + Math.sin(a) * 15.9 * k);
    g.lineTo(c + Math.cos(a) * 170 * k, c + Math.sin(a) * 170 * k);
    g.stroke();
  }
  g.globalAlpha = 1;
  if (numbers) {
    g.fillStyle = col.text;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const font = css('--font-display') || 'sans-serif';
    g.font = `700 ${Math.round(size * 0.062)}px ${font}`;
    ORDER.forEach((n, i) => {
      const a = -Math.PI / 2 + i * seg;
      const r = size * 0.448;
      g.fillText(String(n), c + Math.cos(a) * r, c + Math.sin(a) * r);
    });
  }
}

// A racked set of pool balls with the cue ball waiting, for the billiards hero.
const RACK = [[1], [11, 5], [2, 8, 10], [9, 7, 14, 4], [6, 15, 13, 3, 12]];

function drawPoolBall(g, x, y, r, n, font) {
  const base = n === 0 ? css('--board-cream') : css(`--ball-${n > 8 ? n - 8 : n}`) || '#c33';
  const cream = css('--board-cream') || '#e8dcbc';
  g.save();
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = n > 8 || n === 0 ? cream : base;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  if (n > 8) {
    g.fillStyle = base;
    g.fillRect(x - r, y - r * 0.56, r * 2, r * 1.12);
  }
  if (n > 0) {
    g.beginPath();
    g.arc(x, y, r * 0.44, 0, Math.PI * 2);
    g.fillStyle = cream;
    g.fill();
    g.fillStyle = css('--ink') || '#0e0d0b';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `800 ${Math.round(r * 0.62)}px ${font}`;
    g.fillText(String(n), x, y + r * 0.04);
  }
  const shine = g.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.05, x, y, r * 1.05);
  shine.addColorStop(0, 'rgba(255,255,255,0.55)');
  shine.addColorStop(0.25, 'rgba(255,255,255,0.08)');
  shine.addColorStop(0.75, 'rgba(0,0,0,0)');
  shine.addColorStop(1, 'rgba(0,0,0,0.45)');
  g.fillStyle = shine;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  g.restore();
}

export function drawRack(canvas) {
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const size = canvas.clientWidth || 280;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, size, size);
  const font = css('--font-display') || 'sans-serif';
  const r = size * 0.072;
  g.save();
  g.translate(size * 0.24, size * 0.52);
  g.rotate(-0.32);
  RACK.forEach((row, i) => {
    row.forEach((n, j) => {
      const x = i * r * 1.75;
      const y = (j - (row.length - 1) / 2) * r * 2.04;
      g.beginPath();
      g.arc(x + r * 0.12, y + r * 0.2, r, 0, Math.PI * 2);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fill();
      drawPoolBall(g, x, y, r, n, font);
    });
  });
  g.restore();
  drawPoolBall(g, size * 0.07, size * 0.66, r * 0.92, 0, font);
}

let confettiRaf = 0;

export function confetti(canvas, { count = 160, duration = 2600 } = {}) {
  if (!canvas || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  cancelAnimationFrame(confettiRaf);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const colors = [css('--red'), css('--green'), css('--brass'), css('--board-cream'), css('--sisal')];
  const parts = Array.from({ length: count }, () => ({
    x: w / 2 + (Math.random() - 0.5) * w * 0.3,
    y: h * 0.35,
    vx: (Math.random() - 0.5) * 9,
    vy: -Math.random() * 11 - 4,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    s: 5 + Math.random() * 6,
    c: colors[Math.floor(Math.random() * colors.length)],
  }));
  const t0 = performance.now();
  const frame = (now) => {
    const t = now - t0;
    g.clearRect(0, 0, w, h);
    g.globalAlpha = Math.max(0, 1 - Math.max(0, t - duration * 0.6) / (duration * 0.4));
    for (const p of parts) {
      p.vy += 0.28;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.r);
      g.fillStyle = p.c;
      g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      g.restore();
    }
    if (t < duration) confettiRaf = requestAnimationFrame(frame);
    else g.clearRect(0, 0, w, h);
  };
  confettiRaf = requestAnimationFrame(frame);
}
