// Konfettieső vásznon (F-R5), a két jutalomjáték közös befejezése.
// A darabok a képernyő teteje fölül hullanak, lengve, forogva, az utolsó fél mp-ben elhalványulva.
// Csökkentett mozgásnál álló, szétszórt konfetti.

export const CONFETTI_MS = 3000;
const COLORS = ['#F2B5A7', '#F5D58F', '#B5D5BB', '#A7C8E0', '#CBB8DE', '#EFC2D3', '#E8590C', '#2E6B66', '#FFD43B'];
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A konfettit a `parent`-be rajzolja; a visszaadott függvény leállítja (a vászon a szülővel együtt törlődik). */
export function confetti(parent) {
  const W = innerWidth, H = innerHeight, dpr = Math.min(2, devicePixelRatio || 1);
  const cv = document.createElement('canvas');
  cv.className = 'confetti'; cv.width = W * dpr; cv.height = H * dpr;
  parent.append(cv);
  const g = cv.getContext('2d'); g.scale(dpr, dpr);
  const n = Math.round(Math.min(320, Math.max(140, (W * H) / 4500)));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const bits = Array.from({ length: n }, () => ({
    x: rnd(0, W), y: reduced() ? rnd(0, H) : rnd(-H * 0.7, -10),
    vy: rnd(H * 0.35, H * 0.6), sway: rnd(20, 60), ph: rnd(0, 6.3), f: rnd(1.5, 3.5),
    rot: rnd(0, 6.3), vr: rnd(-6, 6), w: rnd(9, 15), h: rnd(5, 8),
    c: COLORS[Math.floor(Math.random() * COLORS.length)],
  }));
  const draw = (t) => {
    g.clearRect(0, 0, W, H);
    g.globalAlpha = Math.min(1, Math.max(0, (CONFETTI_MS - t * 1000) / 500));
    for (const b of bits) {
      const x = b.x + Math.sin(b.ph + t * b.f) * b.sway, y = b.y + b.vy * t;
      if (y < -20 || y > H + 20) continue;
      g.save(); g.translate(x, y); g.rotate(b.rot + b.vr * t);
      g.scale(1, Math.abs(Math.cos(b.ph + t * b.f * 1.7)) * 0.8 + 0.2);    // billegés: a lap fordul
      g.fillStyle = b.c; g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      g.restore();
    }
  };
  if (reduced()) { draw(0); return () => {}; }
  let t0 = 0, raf = 0;
  const frame = (now) => {
    t0 ||= now;
    const t = (now - t0) / 1000;
    draw(t);
    if (t * 1000 < CONFETTI_MS) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
