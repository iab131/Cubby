import * as THREE from 'three';
import { mat, box, cyl, sph, plane, canvasTex, rr, rand } from './three-helpers.js';

/* ---------- room decor: a window, pictures on the walls, and lighting ----------
   Part of the room code, under "decor". Everything is checked like the rest of the code.
   Walls: "back" runs along x at z = -5, "left" runs along z at x = -5. "at" is the spot along the wall. */

export const VIEWS = ['city', 'sunset', 'forest', 'ocean', 'mountains', 'snow', 'space'];
export const PIC_STYLES = ['photo', 'poster', 'abstract', 'mountains', 'sunset', 'portrait', 'stripes'];
export const MOODS = ['warm', 'cool', 'day', 'night', 'neon'];
export const LAMPS = ['floor', 'table', 'pendant', 'string', 'strip'];
const WALLS = ['back', 'left'];
const MAX_PICS = 5, MAX_LAMPS = 5;

const txt = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const num = (v, lo, hi, d) => { const x = Number(v); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };
const hex = (v, d) => /^#[0-9a-fA-F]{6}$/.test(String(v || '')) ? String(v) : d;
const pick = (v, list, d) => list.includes(v) ? v : d;

export function cleanDecor(d) {
  if (!d || typeof d !== 'object') return null;
  const out = {};
  if (d.window && typeof d.window === 'object') {
    out.window = { wall: pick(d.window.wall, WALLS, 'left'), at: num(d.window.at, -3.2, 3.2, -1.5), view: pick(d.window.view, VIEWS, 'city') };
  }
  out.pictures = (Array.isArray(d.pictures) ? d.pictures : []).slice(0, MAX_PICS).filter(p => p && typeof p === 'object').map(p => {
    const size = Array.isArray(p.size) ? p.size : [];
    return {
      wall: pick(p.wall, WALLS, 'back'), at: num(p.at, -4.2, 4.2, 0), y: num(p.y, 1.4, 4.6, 3.4),
      size: [num(size[0], 0.4, 2.2, 1), num(size[1], 0.4, 2.2, 1.2)],
      style: pick(p.style, PIC_STYLES, 'abstract'), title: txt(p.title, 24),
      colors: (Array.isArray(p.colors) ? p.colors : []).slice(0, 3).map(c => hex(c, null)).filter(Boolean)
    };
  });
  const l = d.lights && typeof d.lights === 'object' ? d.lights : {};
  out.lights = {
    mood: pick(l.mood, MOODS, 'warm'),
    lamps: (Array.isArray(l.lamps) ? l.lamps : []).slice(0, MAX_LAMPS).filter(p => p && typeof p === 'object').map(p => {
      const kind = pick(p.kind, LAMPS, 'floor');
      const lamp = { kind, color: hex(p.color, '#FFD39A') };
      if (kind === 'string' || kind === 'strip') lamp.wall = pick(p.wall, WALLS, 'back');
      else { const a = Array.isArray(p.at) ? p.at : []; lamp.at = [num(a[0], -4.4, 4.4, 0), num(a[1], -4.4, 4.4, 0)]; }
      return lamp;
    })
  };
  return out;
}

/* rooms made before decor existed still get a window and a lamp */
export function defaultDecor(seed) {
  return { window: { wall: 'left', at: -2, view: VIEWS[seed % VIEWS.length] }, pictures: [], lights: { mood: 'warm', lamps: [{ kind: 'pendant', at: [0.6, 0.8], color: '#FFD39A' }] } };
}

/* ---------- shared soft-light textures (fake lighting: no real lights, so 80 rooms stay fast) ---------- */
let GLOW, WASH, PATCH;
function lightTex() {
  if (GLOW) return;
  GLOW = canvasTex(128, 128, (x, w, h) => { const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }).t;
  WASH = canvasTex(16, 128, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }).t;
  PATCH = canvasTex(128, 128, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.filter = 'blur(6px)'; x.fillRect(14, 0, w - 28, h - 10);
  }).t;
}
const addMat = (map, color, opacity) => new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
function halo(parent, color, size, x, y, z, opacity = 0.8) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  s.scale.set(size, size, 1); s.position.set(x, y, z); parent.add(s); return s;
}
function pool(parent, color, r, x, z, opacity = 0.45) {
  const p = plane(r * 2, r * 2, addMat(GLOW, color, opacity), x, 0.045, z, parent); p.rotation.x = -Math.PI / 2; return p;
}
const bulbMat = color => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).lerp(new THREE.Color('#FFFFFF'), 0.55), toneMapped: false });

/* a group standing on a wall's inside face: local x runs along the wall, local +z points into the room */
function wallFrame(parent, wall, at) {
  const g = new THREE.Group();
  if (wall === 'left') { g.position.set(-5.0, 0, at); g.rotation.y = Math.PI / 2; }
  else g.position.set(at, 0, -5.0);
  parent.add(g); return g;
}

/* ---------- window views ---------- */
function drawView(view, seed) {
  const R = rand(seed + 7);
  return canvasTex(512, 432, (x, w, h) => {
    const sky = (a, b, c) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, a); if (c) g.addColorStop(0.62, b); g.addColorStop(1, c || b); x.fillStyle = g; x.fillRect(0, 0, w, h); };
    const tri = (cx, base, hw, ht, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(cx - hw, base); x.lineTo(cx, base - ht); x.lineTo(cx + hw, base); x.closePath(); x.fill(); };
    const stars = (n, a) => { for (let i = 0; i < n; i++) { x.fillStyle = `rgba(255,255,255,${a * (0.4 + R() * 0.6)})`; x.fillRect(R() * w, R() * h * 0.7, 2, 2); } };
    const hill = (y0, amp, col, f = 1) => { x.fillStyle = col; x.beginPath(); x.moveTo(0, h); for (let i = 0; i <= 32; i++) { const px = i / 32 * w; x.lineTo(px, y0 + Math.sin(i * 0.5 * f + seed % 7) * amp + Math.sin(i * 1.3 * f) * amp * 0.4); } x.lineTo(w, h); x.fill(); };
    if (view === 'city') {
      sky('#070B24', '#1B2552', '#3A3F78'); stars(90, 0.9);
      x.fillStyle = '#F4EFD9'; x.beginPath(); x.arc(w * 0.78, h * 0.2, 26, 0, 7); x.fill();
      for (const [col, base, lit] of [['#1C2248', h * 0.52, 0.18], ['#0E1230', h * 0.36, 0.34]]) {
        let px = -10; while (px < w) { const bw = 36 + R() * 50, bh = h - base - R() * 110; x.fillStyle = col; x.fillRect(px, h - bh, bw, bh);
          for (let yy = h - bh + 10; yy < h - 8; yy += 16) for (let xx = px + 6; xx < px + bw - 8; xx += 12) if (R() < lit) { x.fillStyle = R() < 0.8 ? '#FFD37A' : '#8FE3FF'; x.fillRect(xx, yy, 6, 8); }
          px += bw + 4; }
      }
    } else if (view === 'sunset') {
      sky('#3B2A6B', '#E0567A', '#FFB36B');
      x.fillStyle = '#FFE2A0'; x.beginPath(); x.arc(w * 0.55, h * 0.68, 58, 0, 7); x.fill();
      hill(h * 0.72, 18, '#6B2F5E', 0.8); hill(h * 0.82, 14, '#3A1E45', 1.2);
      for (let i = 0; i < 4; i++) { x.strokeStyle = 'rgba(40,20,50,.8)'; x.lineWidth = 3; const bx = 80 + i * 26, by = 90 + (i % 2) * 14; x.beginPath(); x.moveTo(bx - 8, by); x.lineTo(bx, by + 5); x.lineTo(bx + 8, by); x.stroke(); }
    } else if (view === 'forest') {
      sky('#7CC4F2', '#D8F0FF'); hill(h * 0.6, 12, '#7FBF7A');
      for (const [n, base, s, col] of [[9, h * 0.72, 0.8, '#3F8F55'], [7, h * 0.86, 1.1, '#2B6E42'], [5, h * 1.02, 1.5, '#1D5234']]) {
        for (let i = 0; i < n; i++) { const cx = (i + R() * 0.8) / n * w * 1.1 - 20; for (let k = 0; k < 3; k++) tri(cx, base - k * 34 * s, 42 * s - k * 9 * s, 70 * s, col); x.fillStyle = '#4A3222'; x.fillRect(cx - 5 * s, base, 10 * s, 14 * s); }
      }
    } else if (view === 'ocean') {
      sky('#76C6F5', '#E6F7FF'); x.fillStyle = '#FFF4C9'; x.beginPath(); x.arc(w * 0.25, h * 0.22, 34, 0, 7); x.fill();
      const g = x.createLinearGradient(0, h * 0.55, 0, h); g.addColorStop(0, '#2A9BD8'); g.addColorStop(1, '#0F5E99'); x.fillStyle = g; x.fillRect(0, h * 0.55, w, h);
      x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 2; for (let i = 0; i < 26; i++) { const yy = h * 0.58 + R() * h * 0.4, xx = R() * w; x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx + 18 + R() * 30, yy); x.stroke(); }
      x.fillStyle = '#F7F4EE'; x.beginPath(); x.moveTo(w * 0.66, h * 0.52); x.lineTo(w * 0.66, h * 0.36); x.lineTo(w * 0.73, h * 0.52); x.fill(); x.fillStyle = '#7A4A2E'; x.fillRect(w * 0.63, h * 0.52, w * 0.12, 8);
    } else if (view === 'mountains') {
      sky('#8DB8FF', '#EEF5FF');
      for (const [cx, hw, ht, col] of [[w * 0.28, 170, 230, '#6C7FA8'], [w * 0.72, 200, 270, '#55668F'], [w * 0.5, 150, 180, '#7C8FB5']]) {
        tri(cx, h * 0.78, hw, ht, col); x.fillStyle = '#FFFFFF'; x.beginPath(); x.moveTo(cx - hw * 0.28, h * 0.78 - ht * 0.72); x.lineTo(cx, h * 0.78 - ht); x.lineTo(cx + hw * 0.28, h * 0.78 - ht * 0.72); x.lineTo(cx + hw * 0.1, h * 0.78 - ht * 0.66); x.lineTo(cx - hw * 0.08, h * 0.78 - ht * 0.74); x.fill();
      }
      hill(h * 0.8, 10, '#6FAF6B'); hill(h * 0.9, 8, '#4E8C4E', 1.4);
    } else if (view === 'snow') {
      sky('#B7C8DD', '#EEF3F8'); hill(h * 0.62, 16, '#E4ECF5'); hill(h * 0.78, 12, '#F7FAFD', 1.3);
      for (let i = 0; i < 6; i++) { const cx = R() * w, base = h * (0.7 + R() * 0.2); for (let k = 0; k < 3; k++) tri(cx, base - k * 22, 28 - k * 6, 44, '#2F4A3C'); x.fillStyle = '#FFFFFF'; tri(cx, base - 58, 10, 16, '#FFFFFF'); }
      for (let i = 0; i < 120; i++) { x.fillStyle = 'rgba(255,255,255,.95)'; x.beginPath(); x.arc(R() * w, R() * h, 1 + R() * 2.4, 0, 7); x.fill(); }
    } else {
      sky('#03040C', '#0B0D22'); stars(220, 1);
      const n = x.createRadialGradient(w * 0.3, h * 0.35, 10, w * 0.3, h * 0.35, 180); n.addColorStop(0, 'rgba(255,90,190,.45)'); n.addColorStop(0.5, 'rgba(120,80,255,.2)'); n.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = n; x.fillRect(0, 0, w, h);
      x.fillStyle = '#E3A45E'; x.beginPath(); x.arc(w * 0.68, h * 0.6, 62, 0, 7); x.fill();
      x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.arc(w * 0.7 + 14, h * 0.6 + 10, 58, 0, 7); x.fill();
      x.strokeStyle = '#F6D7A8'; x.lineWidth = 6; x.beginPath(); x.ellipse(w * 0.68, h * 0.6, 110, 26, -0.25, 0, 7); x.stroke();
    }
  }).t;
}
const DAYLIGHT = { city: ['#9FB4FF', 0.14], sunset: ['#FFB27A', 0.32], forest: ['#FFF1C8', 0.3], ocean: ['#FFF4D6', 0.34], mountains: ['#F4F7FF', 0.3], snow: ['#EAF2FF', 0.3], space: ['#B9A4FF', 0.14] };

function buildWindow(g, win, seed, color) {
  const wg = wallFrame(g, win.wall, win.at);
  const W = 2.5, H = 2.1, Y = 3.35;
  plane(W, H, new THREE.MeshBasicMaterial({ map: drawView(win.view, seed), toneMapped: false }), 0, Y, 0.012, wg);
  const frame = mat('#F1ECE3', 0.6), t = 0.13, d = 0.14;
  box(W + t * 2, t, d, frame, 0, Y + H / 2 + t / 2, d / 2, wg); box(W + t * 2, t, d, frame, 0, Y - H / 2 - t / 2, d / 2, wg);
  box(t, H, d, frame, -W / 2 - t / 2, Y, d / 2, wg); box(t, H, d, frame, W / 2 + t / 2, Y, d / 2, wg);
  box(0.06, H, 0.08, frame, 0, Y, 0.05, wg); box(W, 0.06, 0.08, frame, 0, Y + 0.1, 0.05, wg);
  box(W + 0.5, 0.09, 0.36, mat('#E6DFD3', 0.6), 0, Y - H / 2 - t - 0.03, 0.18, wg);
  // curtains in the room colour, folded
  const cur = mat(new THREE.Color(color).lerp(new THREE.Color('#F3EDE3'), 0.35), 0.95);
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) box(0.2, H + 0.75, 0.07, cur, side * (W / 2 + 0.22 + i * 0.17), Y - 0.12, 0.2 + (i % 2) * 0.06, wg);
  cyl(0.035, 0.035, W + 1.5, mat('#3A3440', 0.5, 0.4), 0, Y + H / 2 + 0.36, 0.22, wg).rotation.z = Math.PI / 2;
  // daylight on the floor, fading into the room
  const [lc, lo] = DAYLIGHT[win.view];
  const p = plane(W + 0.2, 3.6, addMat(PATCH, lc, lo), 0.25, 0.045, 1.95, wg); p.rotation.x = -Math.PI / 2;
  const glass = plane(W, H, addMat(WASH, lc, 0.08), 0, Y, 0.03, wg); glass.rotation.z = Math.PI;
}

/* ---------- pictures ---------- */
function drawPicture(p, seed, roomColor, font) {
  const R = rand(seed + 3);
  const [c1, c2, c3] = [p.colors[0] || roomColor, p.colors[1] || '#F2C14E', p.colors[2] || '#2CC4B3'];
  const pxW = 384, pxH = Math.round(384 * p.size[1] / p.size[0]);
  return canvasTex(pxW, Math.min(768, Math.max(160, pxH)), (x, w, h) => {
    const words = (s, maxW, size, weight = 700) => { // wrap a title into lines that fit
      x.font = `${weight} ${size}px ${font}`; const out = []; let line = '';
      for (const wd of s.split(' ')) { const t = line ? line + ' ' + wd : wd; if (x.measureText(t).width > maxW && line) { out.push(line); line = wd; } else line = t; }
      if (line) out.push(line); return out;
    };
    if (p.style === 'photo') {
      x.fillStyle = '#F7F5F0'; x.fillRect(0, 0, w, h);
      const m = w * 0.07, ih = h - m - (p.title ? h * 0.2 : m);
      const g = x.createLinearGradient(0, m, 0, m + ih); g.addColorStop(0, c3); g.addColorStop(1, '#FFFFFF'); x.fillStyle = g; x.fillRect(m, m, w - m * 2, ih);
      x.fillStyle = c2; x.beginPath(); x.arc(w * (0.3 + R() * 0.4), m + ih * 0.35, w * 0.09, 0, 7); x.fill();
      x.fillStyle = c1; x.beginPath(); x.moveTo(m, m + ih); for (let i = 0; i <= 8; i++) x.lineTo(m + (w - m * 2) * i / 8, m + ih * (0.62 + Math.sin(i * 1.3 + seed) * 0.08)); x.lineTo(w - m, m + ih); x.fill();
      if (p.title) { x.fillStyle = '#2A2630'; x.textAlign = 'center'; x.textBaseline = 'middle'; let s = Math.round(h * 0.09); x.font = `600 ${s}px Caveat, ${font}`; while (x.measureText(p.title).width > w - m * 2 && s > 14) { s -= 2; x.font = `600 ${s}px Caveat, ${font}`; } x.fillText(p.title, w / 2, h - h * 0.1); }
      return;
    }
    if (p.style === 'poster') {
      x.fillStyle = c1; x.fillRect(0, 0, w, h);
      x.fillStyle = c2; x.beginPath(); x.arc(w * 0.5, h * 0.36, w * 0.3, 0, 7); x.fill();
      x.fillStyle = c3; x.fillRect(0, h * 0.62, w, h * 0.06);
      const t = (p.title || 'Hello').toUpperCase(); let s = Math.round(w * 0.16), ls;
      do { ls = words(t, w * 0.86, s); s -= 4; } while ((ls.length * s * 1.05 > h * 0.3 || ls.some(l => x.measureText(l).width > w * 0.86)) && s > 14);
      x.fillStyle = '#FFFFFF'; x.textAlign = 'center'; x.textBaseline = 'top'; ls.forEach((l, i) => x.fillText(l, w / 2, h * 0.7 + i * s * 1.08));
      return;
    }
    if (p.style === 'abstract') {
      x.fillStyle = '#F3EEE4'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 7; i++) { x.fillStyle = [c1, c2, c3][i % 3]; x.globalAlpha = 0.85; const r = w * (0.08 + R() * 0.2); if (R() < 0.5) { x.beginPath(); x.arc(R() * w, R() * h, r, 0, 7); x.fill(); } else x.fillRect(R() * w - r, R() * h - r, r * 1.6, r * (0.6 + R())); }
      x.globalAlpha = 1; x.strokeStyle = '#1E1B24'; x.lineWidth = 5; x.beginPath(); x.moveTo(w * 0.1, h * (0.3 + R() * 0.4)); x.bezierCurveTo(w * 0.4, 0, w * 0.6, h, w * 0.9, h * 0.5); x.stroke();
    } else if (p.style === 'mountains') {
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#FDF6EA'); g.addColorStop(1, c3); x.fillStyle = g; x.fillRect(0, 0, w, h);
      [[0.3, 0.55, c1], [0.7, 0.45, c2], [0.5, 0.7, c1]].forEach(([cx, ht, col], i) => { x.fillStyle = col; x.globalAlpha = 0.7 + i * 0.15; x.beginPath(); x.moveTo(w * (cx - 0.45), h); x.lineTo(w * cx, h * (1 - ht)); x.lineTo(w * (cx + 0.45), h); x.fill(); });
      x.globalAlpha = 1;
    } else if (p.style === 'sunset') {
      const bands = [c1, c2, c3, '#FFE7B8']; bands.forEach((col, i) => { x.fillStyle = col; x.fillRect(0, i * h / 4, w, h / 4 + 1); });
      x.fillStyle = '#FFF6DE'; x.beginPath(); x.arc(w / 2, h * 0.62, w * 0.2, Math.PI, 0); x.fill();
      x.fillStyle = 'rgba(30,20,40,.85)'; x.fillRect(0, h * 0.62, w, h * 0.38);
      x.strokeStyle = 'rgba(255,230,190,.6)'; x.lineWidth = 3; for (let i = 0; i < 5; i++) { const yy = h * (0.67 + i * 0.06); x.beginPath(); x.moveTo(w * (0.35 - i * 0.03), yy); x.lineTo(w * (0.65 + i * 0.03), yy); x.stroke(); }
    } else if (p.style === 'portrait') {
      x.fillStyle = c1; x.fillRect(0, 0, w, h);
      x.fillStyle = c2; x.beginPath(); x.arc(w / 2, h * 0.4, w * 0.2, 0, 7); x.fill();
      x.beginPath(); x.ellipse(w / 2, h * 1.02, w * 0.38, h * 0.36, 0, Math.PI, 0); x.fill();
      x.fillStyle = c3; x.beginPath(); x.arc(w / 2, h * 0.33, w * 0.21, Math.PI * 1.05, Math.PI * 1.95); x.fill();
    } else {
      const cols = [c1, c2, c3, '#F3EEE4']; const n = 5 + Math.floor(R() * 4); for (let i = 0; i < n; i++) { x.fillStyle = cols[i % 4]; x.fillRect(i * w / n, 0, w / n + 1, h); }
    }
    x.strokeStyle = 'rgba(0,0,0,.12)'; x.lineWidth = 10; x.strokeRect(0, 0, w, h);
  }).t;
}
function plaque(text, font) {
  return canvasTex(512, 96, (x, w, h) => {
    x.fillStyle = '#F4EFE6'; rr(x, 2, 2, w - 4, h - 4, 10); x.fill();
    x.fillStyle = '#2A2630'; x.textAlign = 'center'; x.textBaseline = 'middle'; let s = 48; x.font = `600 ${s}px ${font}`;
    while (x.measureText(text).width > w - 40 && s > 18) { s -= 3; x.font = `600 ${s}px ${font}`; } x.fillText(text, w / 2, h / 2 + 2);
  }).t;
}
function buildPicture(g, p, seed, roomColor, font) {
  const [w, h] = p.size;
  const wg = wallFrame(g, p.wall, p.at);
  const R = rand(seed);
  const frameCol = ['#1F1C24', '#7A5536', '#F3EFE7', '#2E2A33'][Math.floor(R() * 4)];
  box(w + 0.14, h + 0.14, 0.06, mat(frameCol, 0.6), 0, p.y, 0.03, wg);
  plane(w, h, new THREE.MeshStandardMaterial({ map: drawPicture(p, seed, roomColor, font), roughness: 0.8 }), 0, p.y, 0.065, wg);
  if (p.title && p.style !== 'photo' && p.style !== 'poster') {
    plane(Math.min(1.3, w + 0.2), Math.min(1.3, w + 0.2) * 96 / 512, new THREE.MeshStandardMaterial({ map: plaque(p.title, font), roughness: 0.7 }), 0, p.y - h / 2 - 0.2, 0.02, wg);
  }
}

/* keep pictures off the window and the name poster: slide them along the wall if they overlap */
function placePictures(pics, blockers) {
  const placed = [];
  for (const p of pics) {
    const q = { ...p };
    q.y = Math.min(q.y, 4.95 - q.size[1] / 2 - 0.07);
    q.y = Math.max(q.y, 0.6 + q.size[1] / 2 + (q.title ? 0.35 : 0));
    const hit = (b, at) => b.wall === q.wall && Math.abs(at - b.at) < (b.w + q.size[0]) / 2 + 0.25 && Math.abs(q.y - b.y) < (b.h + q.size[1]) / 2 + 0.2;
    const all = () => [...blockers, ...placed];
    for (let tries = 0; tries < 4; tries++) {
      const b = all().find(b => hit(b, q.at)); if (!b) break;
      const gap = (b.w + q.size[0]) / 2 + 0.3;
      const opts = [b.at - gap, b.at + gap].filter(a => Math.abs(a) + q.size[0] / 2 <= 4.8).sort((a, c) => Math.abs(a - q.at) - Math.abs(c - q.at));
      if (!opts.length) break;
      q.at = opts.find(a => !all().some(o => hit(o, a))) ?? opts[0];
    }
    placed.push({ wall: q.wall, at: q.at, y: q.y, w: q.size[0], h: q.size[1] + (q.title ? 0.4 : 0) });
    q.at = Math.max(-4.8 + q.size[0] / 2, Math.min(4.8 - q.size[0] / 2, q.at));
    q.placed = true; pics[pics.indexOf(p)] = q;
  }
  return pics;
}

/* ---------- lamps (fake light: glowing bulbs, halos and soft pools of light) ---------- */
function buildLamp(g, l, anims, seed) {
  const c = l.color, metal = mat('#2B2830', 0.45, 0.5), shadeM = mat(new THREE.Color(c).lerp(new THREE.Color('#F7F1E6'), 0.6), 0.9, 0, { side: THREE.DoubleSide, emissive: c, emissiveIntensity: 0.35 });
  if (l.kind === 'floor') {
    const [x, z] = l.at;
    cyl(0.3, 0.34, 0.06, metal, x, 0.03, z, g); cyl(0.03, 0.03, 3.3, metal, x, 1.7, z, g);
    cyl(0.32, 0.5, 0.62, shadeM, x, 3.55, z, g, 24, true); sph(0.13, bulbMat(c), x, 3.45, z, g, 12);
    halo(g, c, 2.6, x, 3.5, z, 0.75); pool(g, c, 2.4, x, z, 0.5);
    const up = plane(1.6, 1.6, addMat(GLOW, c, 0.25), x, 3.9, z, g); up.rotation.x = -Math.PI / 2; up.position.y = 3.87;
  } else if (l.kind === 'table') {
    const [x, z] = l.at, wood = mat('#6E4B34', 0.7);
    box(0.9, 0.08, 0.9, wood, x, 1.3, z, g); for (const [dx, dz] of [[-0.36, -0.36], [0.36, -0.36], [-0.36, 0.36], [0.36, 0.36]]) box(0.07, 1.26, 0.07, wood, x + dx, 0.63, z + dz, g);
    cyl(0.14, 0.18, 0.5, mat('#E9E2D6', 0.5), x, 1.58, z, g); cyl(0.2, 0.34, 0.4, shadeM, x, 2.02, z, g, 24, true); sph(0.09, bulbMat(c), x, 1.96, z, g, 10);
    halo(g, c, 1.8, x, 2.0, z, 0.7); pool(g, c, 1.8, x, z, 0.4);
  } else if (l.kind === 'pendant') {
    const [x, z] = l.at;
    cyl(0.012, 0.012, 1.3, mat('#1B1A1F', 0.6), x, 5.85, z, g, 6);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), shadeM); dome.position.set(x, 5.0, z); g.add(dome);
    sph(0.14, bulbMat(c), x, 4.95, z, g, 12);
    halo(g, c, 2.2, x, 4.85, z, 0.7); pool(g, c, 3.2, x, z, 0.4);
    let t = seed % 10; anims.push(dt => { t += dt; dome.rotation.z = Math.sin(t * 0.7) * 0.015; });
  } else if (l.kind === 'string') {
    const wg = wallFrame(g, l.wall, 0), n = 18, R = rand(seed), cols = ['#FFD37A', '#FF8A8A', '#8FE3FF', '#A6FF9E', '#FFB0F0'];
    const wire = new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => new THREE.Vector3(-4.6 + i * 1.15, 5.0 - Math.abs(Math.sin(i * Math.PI / 2)) * 0.35, 0.08)));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(wire, 64, 0.012, 5), mat('#1B1A1F', 0.6)); wg.add(tube);
    const bulbs = [];
    for (let i = 0; i < n; i++) { const p = wire.getPoint((i + 0.5) / n); const bc = l.color === '#FFD39A' ? cols[Math.floor(R() * cols.length)] : c; const b = sph(0.06, bulbMat(bc), p.x, p.y - 0.06, p.z + 0.02, wg, 8); bulbs.push(b); halo(wg, bc, 0.55, p.x, p.y - 0.06, p.z + 0.06, 0.6); }
    const wash = plane(9.6, 2.6, addMat(WASH, c, 0.18), 0, 3.8, 0.03, wg);
    let t = 0; anims.push(dt => { t += dt; bulbs.forEach((b, i) => b.scale.setScalar(0.85 + 0.2 * Math.sin(t * 2 + i * 1.7))); });
  } else if (l.kind === 'strip') {
    const wg = wallFrame(g, l.wall, 0);
    box(9.8, 0.05, 0.05, bulbMat(c), 0, 6.35, 0.06, wg);
    plane(9.8, 3.6, addMat(WASH, c, 0.34), 0, 4.55, 0.02, wg);
    box(9.8, 0.04, 0.04, bulbMat(c), 0, 0.26, 0.05, wg);
    const low = plane(9.8, 0.9, addMat(WASH, c, 0.28), 0, 0.72, 0.02, wg); low.rotation.z = Math.PI;
    const fl = plane(9.8, 1.4, addMat(WASH, c, 0.22), 0, 0.045, 0.7, wg); fl.rotation.x = -Math.PI / 2;
  }
}

/* mood tints the walls and floor, so the lamps and window feel like the light in the room */
const MOOD = { warm: ['#FFDDB0', 0.2, 1], cool: ['#C9DBFF', 0.22, 0.97], day: ['#FFFFFF', 0.14, 1.06], night: ['#1C2446', 0.45, 0.62], neon: ['#2A2140', 0.55, 0.55] };
export function applyMood(mats, mood) {
  const [tint, amt, bright] = MOOD[mood] || MOOD.warm;
  mats.forEach(m => { m.color.lerp(new THREE.Color(tint), amt).multiplyScalar(bright); });
}

export function buildDecor(g, decor, { seed, color, font, anims, posterSpot }) {
  lightTex();
  const blockers = [];
  if (decor.window) { buildWindow(g, decor.window, seed, color); blockers.push({ wall: decor.window.wall, at: decor.window.at, y: 3.3, w: 3.9, h: 2.9 }); }
  if (posterSpot) blockers.push(posterSpot);
  blockers.push({ wall: 'back', at: 0, y: 5.6, w: 5.4, h: 1.2 });
  placePictures((decor.pictures || []).map(p => ({ ...p })), blockers).forEach((p, i) => buildPicture(g, p, seed + 31 * (i + 1), color, font));
  (decor.lights?.lamps || []).forEach((l, i) => buildLamp(g, l, anims, seed + 17 * (i + 1)));
}
