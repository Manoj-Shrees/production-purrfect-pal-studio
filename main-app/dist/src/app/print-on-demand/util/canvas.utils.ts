import { CanvasSize, ImageTransform, PX_PER_CM, MAX_W, MAX_H } from './canvas.types';

// ─── Pure transform helpers ───────────────────────────────────────────────────

export function cmToPx(wcm: number, hcm: number): { w: number; h: number } {
  const w = wcm * PX_PER_CM;
  const h = hcm * PX_PER_CM;
  const ratio = Math.min(MAX_W / w, MAX_H / h, 1);
  return { w: Math.round(w * ratio), h: Math.round(h * ratio) };
}

export function thumbStyle(size: CanvasSize): { width: string; height: string } {
  const r = Math.min(28 / size.wcm, 28 / size.hcm);
  return { width: Math.round(size.wcm * r) + 'px', height: Math.round(size.hcm * r) + 'px' };
}

export function computeFill(cw: number, ch: number, natW: number, natH: number): ImageTransform {
  const scale = Math.max(cw / natW, ch / natH);
  return { scale, x: (cw - natW * scale) / 2, y: (ch - natH * scale) / 2, rotation: 0 };
}

export function computeFit(cw: number, ch: number, natW: number, natH: number): ImageTransform {
  const scale = Math.min(cw / natW, ch / natH);
  return { scale, x: (cw - natW * scale) / 2, y: (ch - natH * scale) / 2, rotation: 0 };
}

export function computeCenter(
  cw: number, ch: number, natW: number, natH: number, scale: number,
): ImageTransform {
  return { scale, x: (cw - natW * scale) / 2, y: (ch - natH * scale) / 2, rotation: 0 };
}

export function zoomAround(
  prev:  ImageTransform,
  px:    number,
  py:    number,
  delta: number,
): ImageTransform {
  const scale = Math.max(0.05, Math.min(6, prev.scale + delta));
  const ratio = scale / prev.scale;
  return {
    scale,
    x:        px - ratio * (px - prev.x),
    y:        py - ratio * (py - prev.y),
    rotation: prev.rotation ?? 0,
  };
}

export function wireHeight(stageH: number, canvasH: number): number {
  return Math.max(Math.round((stageH - canvasH) / 2) - 12, 20);
}

// ─── Responsive helpers ───────────────────────────────────────────────────────
//
// Both helpers below are called with LOGICAL (CSS) stage dimensions and must
// be used identically in computeFaceBounds AND drawMockup — never change one
// without the other.

/**
 * Returns stretcher-bar thicknesses (EDGE, SK) that scale with the stage size
 * so the frame looks proportional on small mobile screens.
 *   logMin ≤ 300 px  →  EDGE 5, SK 3   (mobile)
 *   logMin ≥ 650 px  →  EDGE 10, SK 5  (desktop — original values)
 */
function frameDepth(logW: number, logH: number): { EDGE: number; SK: number } {
  const minDim = Math.min(logW, logH);
  const t = Math.min(1, Math.max(0, (minDim - 300) / 350));
  return {
    EDGE: Math.max(4, Math.round(5 + 5 * t)),
    SK:   Math.max(2, Math.round(3 + 2 * t)),
  };
}

/**
 * Returns the wall padding (PAD_H, PAD_V) around the canvas frame.
 * Smaller padding on mobile = frame fills more of the stage = larger apparent
 * zoom level without changing the product-size simulation logic.
 *   logMin ≤ 320 px  →  PAD_H 35, PAD_V 28  (mobile — frame fills ~80 % of stage)
 *   logMin ≥ 650 px  →  PAD_H 80, PAD_V 65  (desktop — original values)
 */
function stagePadding(logW: number, logH: number): { PAD_H: number; PAD_V: number } {
  const minDim = Math.min(logW, logH);
  const t = Math.min(1, Math.max(0, (minDim - 320) / 330));
  return {
    PAD_H: Math.round(35 + 45 * t),   // 35 → 80
    PAD_V: Math.round(28 + 37 * t),   // 28 → 65
  };
}

/**
 * Computes face pixel dimensions for a given canvas element size + product size.
 *
 * IMPORTANT: pass LOGICAL (CSS) pixel dimensions, not physical canvas.width.
 * Divide canvas.width / devicePixelRatio before calling, or use
 * stage.clientWidth / stage.clientHeight directly.
 */
export function computeFaceBounds(
  logicalWidth:  number,
  logicalHeight: number,
  size:          CanvasSize,
): { fw: number; fh: number } {
  const { PAD_H, PAD_V } = stagePadding(logicalWidth, logicalHeight);
  const { EDGE, SK }     = frameDepth(logicalWidth, logicalHeight);

  const maxCm    = Math.max(size.wcm, size.hcm);
  const relScale = 0.55 + 0.45 * Math.min(1, Math.max(0, (maxCm - 20) / (130 - 20)));

  const maxFW = (logicalWidth  - PAD_H * 2 - EDGE - SK) * relScale;
  const maxFH = (logicalHeight - PAD_V * 2 - EDGE - SK) * relScale;

  const ar = size.wcm / size.hcm;
  let fw = Math.round(maxFH * ar);
  let fh = Math.round(maxFH);
  if (fw > maxFW) { fw = Math.round(maxFW); fh = Math.round(fw / ar); }
  fw = Math.max(fw, 80);
  fh = Math.max(fh, 80);

  return { fw, fh };
}

// ─── Private drawing helpers ──────────────────────────────────────────────────

function sfc32(a: number, b: number, c: number, d: number): () => number {
  return (): number => {
    a = a | 0; b = b | 0; c = c | 0; d = d | 0;
    const t = ((a + b) | 0) + d | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

function makeGrainCanvas(w: number, h: number): HTMLCanvasElement {
  const g = document.createElement('canvas');
  g.width = w; g.height = h;
  const gc = g.getContext('2d')!;
  const id = gc.createImageData(w, h);
  const d  = id.data;
  const r  = sfc32(0xABCDEF01, 0x23456789, 0xFEDCBA98, 0x76543210);
  for (let i = 0; i < d.length; i += 4) {
    const v    = (r() * 255) | 0;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3]   = (v * 0.06 + 5) | 0;
  }
  gc.putImageData(id, 0, 0);
  return g;
}

function drawWoodFill(
  ctx:      CanvasRenderingContext2D,
  x:        number, y: number, w: number, h: number,
  horiz:    boolean,
  lightDir: 'top' | 'left',
): void {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const wg = horiz
    ? ctx.createLinearGradient(x, y, x, y + h)
    : ctx.createLinearGradient(x, y, x + w, y);
  wg.addColorStop(0,    '#9B7248');
  wg.addColorStop(0.10, '#7A5530');
  wg.addColorStop(0.25, '#A07850');
  wg.addColorStop(0.48, '#8B6340');
  wg.addColorStop(0.62, '#7D5830');
  wg.addColorStop(0.82, '#9A7048');
  wg.addColorStop(1,    '#6E4E28');
  ctx.fillStyle = wg;
  ctx.fillRect(x, y, w, h);
  const rg    = sfc32(0x11223344, 0x55667788, 0x99AABBCC, 0xDDEEFF00);
  const lines = horiz ? 10 : 16;
  for (let i = 0; i < lines; i++) {
    const off  = (horiz ? h : w) * (i + rg()) * 0.96 / lines;
    ctx.beginPath();
    const segs = Math.ceil((horiz ? w : h) / 16);
    for (let s = 0; s <= segs; s++) {
      const al = s * (horiz ? w : h) / segs;
      const ac = off + Math.sin(al * 0.08 + rg() * 6.28) * 1.6 * (rg() + 0.4);
      const px = horiz ? x + al : x + ac;
      const py = horiz ? y + ac : y + al;
      s === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.strokeStyle = `rgba(0,0,0,${(0.05 + rg() * 0.08).toFixed(3)})`;
    ctx.lineWidth   = 0.5 + rg() * 1.0;
    ctx.stroke();
  }
  if (rg() > 0.5) {
    const kx = x + (horiz ? w * 0.25 + rg() * w * 0.5 : w * 0.2  + rg() * w * 0.6);
    const ky = y + (horiz ? h * 0.2  + rg() * h * 0.6 : h * 0.25 + rg() * h * 0.5);
    const kr = 2.5 + rg() * 3.5;
    for (let rv = kr; rv > 0; rv -= 0.65) {
      ctx.beginPath();
      ctx.ellipse(kx, ky, rv * (horiz ? 2.8 : 1.6), rv * (horiz ? 1.6 : 2.8), 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(40,20,5,${(0.13 * (rv / kr)).toFixed(3)})`;
      ctx.lineWidth   = 0.8;
      ctx.stroke();
    }
  }
  const sh = horiz
    ? ctx.createLinearGradient(x, y, x, y + h)
    : ctx.createLinearGradient(x, y, x + w, y);
  if (lightDir === 'top') {
    sh.addColorStop(0,    'rgba(255,255,255,0.18)');
    sh.addColorStop(0.35, 'rgba(255,255,255,0.04)');
    sh.addColorStop(0.65, 'rgba(0,0,0,0.06)');
    sh.addColorStop(1,    'rgba(0,0,0,0.30)');
  } else {
    sh.addColorStop(0,    'rgba(255,255,255,0.14)');
    sh.addColorStop(0.30, 'rgba(255,255,255,0.03)');
    sh.addColorStop(0.70, 'rgba(0,0,0,0.09)');
    sh.addColorStop(1,    'rgba(0,0,0,0.34)');
  }
  ctx.fillStyle = sh;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function drawLinenTexture(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
): void {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const s = 3.5;
  ctx.globalAlpha = 0.026; ctx.lineWidth = 0.8;
  for (let i = 0; i < w + h; i += s) {
    ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x, y + i);
    ctx.strokeStyle = '#000'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + i, y + h); ctx.lineTo(x + w, y + h - i);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.014;
  for (let i = 0; i < w; i += s) {
    ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i, y + h);
    ctx.strokeStyle = '#000'; ctx.stroke();
  }
  for (let i = 0; i < h; i += s) {
    ctx.beginPath(); ctx.moveTo(x, y + i); ctx.lineTo(x + w, y + i);
    ctx.strokeStyle = '#000'; ctx.stroke();
  }
  ctx.restore();
}

// ─── Public face bounds ───────────────────────────────────────────────────────

export interface FaceBounds {
  x: number; y: number; w: number; h: number;
}

// ─── Public 3-D mockup renderer ───────────────────────────────────────────────

/**
 * Renders the full 3-D gallery-wrap canvas mockup.
 *
 * dprOverride:
 *   • Omit (or undefined) for the live on-screen canvas — devicePixelRatio
 *     is read automatically and the context is scaled for retina crispness.
 *   • Pass 1 for off-screen export canvases (already physical px, no rescaling).
 *
 * Always returns FaceBounds in LOGICAL (CSS) pixels.
 *
 * Pin and mounting wire intentionally removed — clean frame only.
 */
export function drawMockup(
  canvasEl:     HTMLCanvasElement,
  imgEl:        HTMLImageElement,
  transform:    ImageTransform,
  natW:         number,
  natH:         number,
  size:         CanvasSize,
  hasImage:     boolean,
  screenW:      number,
  screenH:      number,
  dprOverride?: number,
): FaceBounds {
  const ctx      = canvasEl.getContext('2d');
  const fallback: FaceBounds = { x: 0, y: 0, w: 0, h: 0 };
  if (!ctx) return fallback;

  // ── Device-pixel ratio ────────────────────────────────────────────────────
  const dpr = dprOverride ?? Math.min(window.devicePixelRatio || 1, 3);

  // LOGICAL (CSS) stage dimensions — all layout maths and returned bounds use these.
  const TW = canvasEl.width  / dpr;
  const TH = canvasEl.height / dpr;
  if (TW === 0 || TH === 0) return fallback;

  // ── Responsive layout constants (mirrors computeFaceBounds exactly) ───────
  const { PAD_H, PAD_V } = stagePadding(TW, TH);
  const { EDGE, SK }     = frameDepth(TW, TH);

  // ── Face dimensions — aspect-ratio fitted to stage ────────────────────────
  const maxCm    = Math.max(size.wcm, size.hcm);
  const relScale = 0.55 + 0.45 * Math.min(1, Math.max(0, (maxCm - 20) / (130 - 20)));

  const maxFW = (TW - PAD_H * 2 - EDGE - SK) * relScale;
  const maxFH = (TH - PAD_V * 2 - EDGE - SK) * relScale;

  const ar = size.wcm / size.hcm;
  let fw = Math.round(maxFH * ar);
  let fh = Math.round(maxFH);
  if (fw > maxFW) { fw = Math.round(maxFW); fh = Math.round(fw / ar); }
  fw = Math.max(fw, 80); fh = Math.max(fh, 80);

  const fx = Math.round((TW - fw - EDGE - SK) / 2);
  const fy = Math.round((TH - fh - EDGE - SK) / 2);

  const cTL: [number, number] = [fx + fw,        fy + fh];
  const cTR: [number, number] = [fx + fw + EDGE,  fy + fh + SK];
  const cBR: [number, number] = [fx + fw + EDGE,  fy + fh + EDGE];
  const cBL: [number, number] = [fx + fw + SK,    fy + fh + EDGE];

  // ── Scale context to physical pixels for crisp retina rendering ───────────
  ctx.save();
  ctx.scale(dpr, dpr);

  // ── WALL ──────────────────────────────────────────────────────────────────
  const wallGrad = ctx.createRadialGradient(
    fx + fw * 0.35, fy + fh * 0.28, 10,
    fx + fw * 0.5,  fy + fh * 0.5,  TW * 0.8,
  );
  wallGrad.addColorStop(0,    '#f0ebe2');
  wallGrad.addColorStop(0.35, '#e4ded5');
  wallGrad.addColorStop(0.70, '#d6d0c7');
  wallGrad.addColorStop(1,    '#c8c2b9');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, 0, TW, TH);

  const pn   = document.createElement('canvas');
  pn.width   = TW; pn.height = TH;
  const pnc  = pn.getContext('2d')!;
  const pnid = pnc.createImageData(TW, TH);
  const pnd  = pnid.data;
  const rp   = sfc32(0xA1B2C3D4, 0xE5F60718, 0x29304152, 0x63748596);
  for (let i = 0; i < pnd.length; i += 4) {
    const v = (rp() * 255) | 0;
    pnd[i] = pnd[i + 1] = pnd[i + 2] = v;
    pnd[i + 3] = (v * 0.04 + 3) | 0;
  }
  pnc.putImageData(pnid, 0, 0);
  ctx.drawImage(pn, 0, 0, TW, TH);

  const vig = ctx.createRadialGradient(TW / 2, TH * 0.42, TH * 0.12, TW / 2, TH * 0.5, TH * 0.88);
  vig.addColorStop(0,    'rgba(0,0,0,0)');
  vig.addColorStop(0.65, 'rgba(0,0,0,0.05)');
  vig.addColorStop(1,    'rgba(0,0,0,0.28)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, TW, TH);

  const cl = ctx.createLinearGradient(0, 0, 0, TH * 0.28);
  cl.addColorStop(0, 'rgba(255,252,240,0.11)');
  cl.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = cl;
  ctx.fillRect(0, 0, TW, TH * 0.28);

  // ── SHADOWS ───────────────────────────────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, TW, TH);
  ctx.rect(fx + fw, 0, TW - (fx + fw), TH);
  ctx.rect(0, fy + fh, TW, TH - (fy + fh));
  ctx.clip('evenodd');
  ([
    [110, 20, 42, 'rgba(0,0,0,0.15)'],
    [48,   9, 20, 'rgba(0,0,0,0.19)'],
    [15,   3,  7, 'rgba(0,0,0,0.26)'],
    [5,    1,  2, 'rgba(0,0,0,0.22)'],
  ] as [number, number, number, string][]).forEach(([bl, ox, oy, col]) => {
    ctx.save();
    ctx.shadowColor = col; ctx.shadowBlur = bl;
    ctx.shadowOffsetX = ox; ctx.shadowOffsetY = oy;
    ctx.fillStyle = '#000';
    ctx.fillRect(fx, fy, fw, fh);
    ctx.restore();
  });
  ctx.restore();

  ctx.save();
  ctx.beginPath(); ctx.rect(fx + fw, fy, 60, fh); ctx.clip();
  const ss = ctx.createLinearGradient(fx + fw, 0, fx + fw + 60, 0);
  ss.addColorStop(0, 'rgba(0,0,0,0.13)'); ss.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = ss; ctx.fillRect(fx + fw, fy, 60, fh);
  ctx.restore();

  // ── CANVAS FACE ───────────────────────────────────────────────────────────
  ctx.fillStyle = '#f8f6f0';
  ctx.fillRect(fx, fy, fw, fh);

  ctx.save();
  ctx.beginPath(); ctx.rect(fx, fy, fw, fh); ctx.clip();

  if (hasImage && imgEl && imgEl.complete && natW > 0 && screenW > 0 && screenH > 0) {
    const rx  = fw / screenW;
    const ry  = fh / screenH;
    const rot = ((transform.rotation ?? 0) * Math.PI) / 180;

    if (rot !== 0) {
      const pivotX = fx + fw / 2;
      const pivotY = fy + fh / 2;
      ctx.translate(pivotX, pivotY);
      ctx.rotate(rot);
      ctx.translate(-pivotX, -pivotY);
    }

    ctx.drawImage(
      imgEl,
      fx + transform.x * rx,
      fy + transform.y * ry,
      natW * transform.scale * rx,
      natH * transform.scale * ry,
    );
  } else {
    const ph = ctx.createLinearGradient(fx, fy, fx + fw, fy + fh);
    ph.addColorStop(0, '#e8e0d3'); ph.addColorStop(0.5, '#d8cfbf'); ph.addColorStop(1, '#cbc0ae');
    ctx.fillStyle = ph; ctx.fillRect(fx, fy, fw, fh);
    drawLinenTexture(ctx, fx, fy, fw, fh);
  }
  ctx.restore();

  drawLinenTexture(ctx, fx, fy, fw, fh);

  const gs = ctx.createLinearGradient(fx, fy, fx + fw * 0.72, fy + fh * 0.55);
  gs.addColorStop(0,    'rgba(255,255,255,0.15)');
  gs.addColorStop(0.28, 'rgba(255,255,255,0.05)');
  gs.addColorStop(0.55, 'rgba(0,0,0,0)');
  gs.addColorStop(1,    'rgba(0,0,0,0.05)');
  ctx.fillStyle = gs; ctx.fillRect(fx, fy, fw, fh);

  ([
    { g: ctx.createLinearGradient(fx, fy, fx, fy + 24),         c0: 'rgba(0,0,0,0.20)', c1: 'rgba(0,0,0,0)',    x: fx,        y: fy,        w: fw, h: 24 },
    { g: ctx.createLinearGradient(fx, fy, fx + 18, fy),         c0: 'rgba(0,0,0,0.14)', c1: 'rgba(0,0,0,0)',    x: fx,        y: fy,        w: 18, h: fh },
    { g: ctx.createLinearGradient(fx, fy+fh-14, fx, fy+fh),     c0: 'rgba(0,0,0,0)',    c1: 'rgba(0,0,0,0.08)', x: fx,        y: fy+fh-14,  w: fw, h: 14 },
    { g: ctx.createLinearGradient(fx+fw-12, fy, fx+fw, fy),     c0: 'rgba(0,0,0,0)',    c1: 'rgba(0,0,0,0.05)', x: fx+fw-12,  y: fy,        w: 12, h: fh },
  ]).forEach(({ g, c0, c1, x, y, w, h }) => {
    g.addColorStop(0, c0); g.addColorStop(1, c1);
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  });

  ctx.strokeStyle = 'rgba(0,0,0,0.14)'; ctx.lineWidth = 1;
  ctx.strokeRect(fx + 0.5, fy + 0.5, fw - 1, fh - 1);

  ctx.save(); ctx.globalAlpha = 0.48;
  ctx.drawImage(makeGrainCanvas(fw, fh), fx, fy, fw, fh);
  ctx.restore();

  // ── RIGHT STRETCHER BAR ───────────────────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(fx + fw,        fy);
  ctx.lineTo(fx + fw + EDGE, fy + SK);
  ctx.lineTo(fx + fw + EDGE, fy + fh + SK);
  ctx.lineTo(fx + fw,        fy + fh);
  ctx.closePath(); ctx.clip();
  drawWoodFill(ctx, fx + fw, fy, EDGE + SK + 2, fh + SK + 2, false, 'left');
  const re = ctx.createLinearGradient(fx + fw, 0, fx + fw + 6, 0);
  re.addColorStop(0, 'rgba(0,0,0,0.44)'); re.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = re; ctx.fillRect(fx + fw, fy, 6, fh + SK);
  ctx.beginPath(); ctx.moveTo(fx + fw, fy); ctx.lineTo(fx + fw + EDGE, fy + SK);
  ctx.strokeStyle = 'rgba(255,255,255,0.32)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();

  // ── BOTTOM STRETCHER BAR ──────────────────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(fx,           fy + fh);
  ctx.lineTo(fx + fw,      fy + fh);
  ctx.lineTo(fx + fw + SK, fy + fh + EDGE);
  ctx.lineTo(fx + SK,      fy + fh + EDGE);
  ctx.closePath(); ctx.clip();
  drawWoodFill(ctx, fx, fy + fh, fw + SK + 2, EDGE + 2, true, 'top');
  const be = ctx.createLinearGradient(0, fy + fh, 0, fy + fh + 6);
  be.addColorStop(0, 'rgba(0,0,0,0.40)'); be.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = be; ctx.fillRect(fx, fy + fh, fw + SK, 6);
  ctx.beginPath(); ctx.moveTo(fx, fy + fh); ctx.lineTo(fx + SK, fy + fh + EDGE);
  ctx.strokeStyle = 'rgba(255,255,255,0.24)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();

  // ── CORNER CAP ────────────────────────────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cTL[0], cTL[1]); ctx.lineTo(cTR[0], cTR[1]); ctx.lineTo(cBR[0], cBR[1]); ctx.closePath();
  ctx.clip();
  drawWoodFill(ctx, fx + fw, fy + fh, EDGE + SK + 2, EDGE + SK + 2, false, 'left');
  const re2 = ctx.createLinearGradient(fx + fw, 0, fx + fw + 6, 0);
  re2.addColorStop(0, 'rgba(0,0,0,0.42)'); re2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = re2; ctx.fillRect(fx + fw, fy + fh, EDGE + SK + 2, EDGE + SK + 2);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cTL[0], cTL[1]); ctx.lineTo(cBR[0], cBR[1]); ctx.lineTo(cBL[0], cBL[1]); ctx.closePath();
  ctx.clip();
  drawWoodFill(ctx, fx + fw, fy + fh, EDGE + SK + 2, EDGE + SK + 2, true, 'top');
  const be2 = ctx.createLinearGradient(0, fy + fh, 0, fy + fh + 6);
  be2.addColorStop(0, 'rgba(0,0,0,0.38)'); be2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = be2; ctx.fillRect(fx + fw, fy + fh, EDGE + SK + 2, EDGE + SK + 2);
  ctx.restore();

  ctx.beginPath(); ctx.moveTo(cTL[0], cTL[1]); ctx.lineTo(cBR[0], cBR[1]);
  ctx.strokeStyle = 'rgba(0,0,0,0.36)'; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cTL[0] + 1, cTL[1] + 1); ctx.lineTo(cBR[0] - 1, cBR[1] - 1);
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 0.6; ctx.stroke();

  // ── PIN AND MOUNTING WIRE REMOVED ─────────────────────────────────────────

  // Remove dpr scale — callers (e.g. drawWatermark) must apply their own.
  ctx.restore();

  // Return LOGICAL pixel bounds for CSS label positions, hit-testing, and watermark.
  return { x: fx, y: fy, w: fw, h: fh };
}

// ─── Export (download print file) ────────────────────────────────────────────

export function exportPrint(
  imgEl:     HTMLImageElement,
  transform: ImageTransform,
  natW:      number, natH: number,
  size:      CanvasSize,
  screenW:   number, screenH: number,
  onDone:    (msg: string) => void,
): void {
  const EXPORT_W = 1300;
  const EXPORT_H = Math.max(Math.round(EXPORT_W * (size.hcm / size.wcm) * 1.6), 900);

  const cvs    = document.createElement('canvas');
  cvs.width    = EXPORT_W;
  cvs.height   = EXPORT_H;

  // dprOverride=1: export canvas is already in physical pixels.
  const face = drawMockup(cvs, imgEl, transform, natW, natH, size, true, screenW, screenH, 1);
  const ctx  = cvs.getContext('2d')!;

  const finish = () => {
    cvs.toBlob(blob => {
      if (!blob) return;
      const url  = URL.createObjectURL(blob);
      const link = Object.assign(document.createElement('a'), {
        href:     url,
        download: `canvas-mockup-${size.wcm}x${size.hcm}cm.png`,
      });
      link.click();
      URL.revokeObjectURL(url);
      onDone(`Mockup downloaded · ${size.wcm} × ${size.hcm} cm`);
    }, 'image/png');
  };

  const wm = new Image();
  wm.onload = () => {
    const wmW = Math.round(face.w * 0.38);
    const wmH = Math.round(wmW * (wm.naturalHeight / wm.naturalWidth));
    const wmX = face.x + Math.round((face.w - wmW) / 2);
    const wmY = face.y + face.h - wmH - Math.round(face.h * 0.04);

    ctx.save();
    ctx.beginPath(); ctx.rect(face.x, face.y, face.w, face.h); ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(face.x, wmY - 8, face.w, wmH + 16);
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 1.0;
    ctx.drawImage(wm, wmX, wmY, wmW, wmH);
    ctx.restore();
    finish();
  };
  wm.onerror = () => {
    console.warn('PPS-watermark.png not found — exporting without watermark.');
    finish();
  };
  wm.src = '/assets/watermark/PPS-watermark.png';
}