// util/canvas-renderer.ts
// Standalone canvas rendering helpers — no Angular dependencies.

// ── Pseudo-random number generator ───────────────────────────────────────────
export function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (a + b | 0) + d | 0;
    d = d + 1 | 0;
    a = b ^ b >>> 9;
    b = c + (c << 3) | 0;
    c = c << 21 | c >>> 11;
    c = c + t | 0;
    return (t >>> 0) / 4294967296;
  };
}

// ── Grain texture canvas ──────────────────────────────────────────────────────
export function makeGrain(w: number, h: number): HTMLCanvasElement {
  const g  = document.createElement('canvas');
  g.width  = w;
  g.height = h;
  const gc = g.getContext('2d')!;
  const id = gc.createImageData(w, h);
  const d  = id.data;
  const r  = sfc32(0xABCDEF01, 0x23456789, 0xFEDCBA98, 0x76543210);
  for (let i = 0; i < d.length; i += 4) {
    const v       = r() * 255 | 0;
    d[i]          = d[i + 1] = d[i + 2] = v;
    d[i + 3]      = v * 0.06 + 5 | 0;
  }
  gc.putImageData(id, 0, 0);
  return g;
}

// ── Wood grain fill ───────────────────────────────────────────────────────────
/**
 * Fill the current clipped path with wood grain.
 * Caller must have called ctx.save() + ctx.clip() before calling this.
 */
export function fillWood(
  ctx:      CanvasRenderingContext2D,
  bx:       number,
  by:       number,
  bw:       number,
  bh:       number,
  horiz:    boolean,
  lightDir: 'top' | 'left',
): void {
  const wg = horiz
    ? ctx.createLinearGradient(bx, by, bx, by + bh)
    : ctx.createLinearGradient(bx, by, bx + bw, by);
  wg.addColorStop(0,    '#9B7248');
  wg.addColorStop(0.1,  '#7A5530');
  wg.addColorStop(0.25, '#A07850');
  wg.addColorStop(0.48, '#8B6340');
  wg.addColorStop(0.62, '#7D5830');
  wg.addColorStop(0.82, '#9A7048');
  wg.addColorStop(1,    '#6E4E28');
  ctx.fillStyle = wg;
  ctx.fillRect(bx, by, bw, bh);

  // Wavy grain lines
  const rg    = sfc32(0x11223344, 0x55667788, 0x99AABBCC, 0xDDEEFF00);
  const lines = horiz ? 10 : 16;
  ctx.save();
  for (let i = 0; i < lines; i++) {
    const off  = (horiz ? bh : bw) * (i + rg()) * 0.96 / lines;
    const segs = Math.ceil((horiz ? bw : bh) / 16);
    ctx.beginPath();
    for (let s = 0; s <= segs; s++) {
      const al = s * (horiz ? bw : bh) / segs;
      const ac = off + Math.sin(al * 0.08 + rg() * 6.28) * 1.6 * (rg() + 0.4);
      const px = horiz ? bx + al : bx + ac;
      const py = horiz ? by + ac : by + al;
      s === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.strokeStyle = `rgba(0,0,0,${0.05 + rg() * 0.08})`;
    ctx.lineWidth   = 0.5 + rg() * 1.0;
    ctx.stroke();
  }
  ctx.restore();

  // Directional shading
  const sh = horiz
    ? ctx.createLinearGradient(bx, by, bx, by + bh)
    : ctx.createLinearGradient(bx, by, bx + bw, by);
  if (lightDir === 'top') {
    sh.addColorStop(0,    'rgba(255,255,255,0.18)');
    sh.addColorStop(0.35, 'rgba(255,255,255,0.04)');
    sh.addColorStop(0.65, 'rgba(0,0,0,0.06)');
    sh.addColorStop(1,    'rgba(0,0,0,0.30)');
  } else {
    sh.addColorStop(0,    'rgba(255,255,255,0.14)');
    sh.addColorStop(0.3,  'rgba(255,255,255,0.03)');
    sh.addColorStop(0.7,  'rgba(0,0,0,0.09)');
    sh.addColorStop(1,    'rgba(0,0,0,0.34)');
  }
  ctx.fillStyle = sh;
  ctx.fillRect(bx, by, bw, bh);
}

// ── Linen crosshatch texture ──────────────────────────────────────────────────
/** Draw linen crosshatch texture clipped to (x, y, w, h). */
export function drawLinen(
  ctx: CanvasRenderingContext2D,
  x:   number,
  y:   number,
  w:   number,
  h:   number,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  const s = 3.5;
  ctx.lineWidth   = 0.8;
  ctx.globalAlpha = 0.026;
  for (let i = 0; i < w + h; i += s) {
    ctx.beginPath(); ctx.moveTo(x + i, y);     ctx.lineTo(x,     y + i);         ctx.strokeStyle = '#000'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + i, y + h); ctx.lineTo(x + w, y + h - i);     ctx.strokeStyle = '#000'; ctx.stroke();
  }

  ctx.globalAlpha = 0.014;
  for (let i = 0; i < w; i += s) {
    ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i, y + h); ctx.strokeStyle = '#000'; ctx.stroke();
  }
  for (let i = 0; i < h; i += s) {
    ctx.beginPath(); ctx.moveTo(x, y + i); ctx.lineTo(x + w, y + i); ctx.strokeStyle = '#000'; ctx.stroke();
  }

  ctx.restore();
}