import * as THREE from 'three';
import { mat, box, cyl, sph, plane, torus, canvasTex, rr, rand, hashStr, screenMat, glowMat } from './three-helpers.js';

/* Everything a visitor can put in their room, plus the room shell itself.
   Each item is built facing +z inside roughly a 2.6 x 2.6 footprint. */

const cache = {};
const once = (k, f) => (cache[k] ??= f());

function rod(a, b, r, m, parent) {
  const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b);
  const v = new THREE.Vector3().subVectors(Bv, A); const len = v.length();
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), m);
  o.position.copy(A).add(Bv).multiplyScalar(0.5);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
  parent.add(o); return o;
}
const netTex = () => once('net', () => { const t = canvasTex(128, 128, (x, w, h) => { x.strokeStyle = 'rgba(240,240,240,.85)'; x.lineWidth = 2; for (let i = 0; i <= w; i += 12) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); } }).t; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; });
const ballTex = () => once('ball', () => canvasTex(512, 256, (x, w, h) => {
  x.fillStyle = '#F7F7F7'; x.fillRect(0, 0, w, h); x.fillStyle = '#16161B';
  const pent = (cx, cy, r) => { x.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.9); } x.closePath(); x.fill(); };
  for (let i = 0; i < 5; i++) { pent(i * w / 5 + 50, 70, 26); pent(i * w / 5 + 100, 180, 26); }
  pent(w / 2, 8, 40); pent(w / 2, h - 8, 40);
}).t);
const chess8Tex = () => once('chk8', () => { const t = canvasTex(256, 256, (x) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#2B2420' : '#EDE3CF'; x.fillRect(i * 32, j * 32, 32, 32); } }).t; t.magFilter = THREE.NearestFilter; return t; });
const keysTex = () => once('keys', () => canvasTex(512, 96, (x, w, h) => {
  x.fillStyle = '#FAFAF7'; x.fillRect(0, 0, w, h); x.strokeStyle = '#999'; const n = 28, kw = w / n;
  for (let i = 0; i <= n; i++) { x.beginPath(); x.moveTo(i * kw, 0); x.lineTo(i * kw, h); x.stroke(); }
  x.fillStyle = '#141414'; for (let i = 0; i < n; i++) { const m = i % 7; if (m === 2 || m === 6) continue; x.fillRect((i + 1) * kw - kw * 0.3, 0, kw * 0.6, h * 0.6); }
}).t);
const termTex = () => once('term', () => canvasTex(512, 320, (x, w, h) => {
  x.fillStyle = '#0D1117'; x.fillRect(0, 0, w, h); x.font = '18px ui-monospace, Menlo, Consolas, monospace';
  ['$ npm run dev', '  ready on :5173', '$ git commit -m "ship it"', '  1 file changed', '$ python train.py', '  epoch 12  loss 0.041', '$ _'].forEach((t, i) => { x.fillStyle = t.startsWith('$') ? '#E6EDF3' : '#7EE787'; x.fillText(t, 22, 40 + i * 38); });
}).t);
function gameTex(color) {
  return canvasTex(512, 300, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#120B2E'); g.addColorStop(1, '#3A1250'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = color; x.beginPath(); x.arc(w * 0.7, h * 0.35, 46, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#05030F'; x.beginPath(); x.moveTo(0, h); x.lineTo(0, h * 0.62); x.lineTo(120, h * 0.5); x.lineTo(220, h * 0.66); x.lineTo(340, h * 0.48); x.lineTo(w, h * 0.64); x.lineTo(w, h); x.fill();
    x.strokeStyle = color; x.lineWidth = 2; for (let i = 0; i < 9; i++) { x.beginPath(); x.moveTo(w / 2, h * 0.72); x.lineTo(-200 + i * 110, h); x.stroke(); }
    x.fillStyle = '#fff'; x.font = 'bold 26px system-ui'; x.fillText('PLAYER 1', 20, 36);
  }).t;
}
function artTex(color, seed) {
  return canvasTex(256, 320, (x, w, h) => {
    x.fillStyle = '#F6F1E6'; x.fillRect(0, 0, w, h); const r = rand(seed);
    const cols = [color, '#F2C14E', '#2F6FD6', '#E8402F', '#2CC4B3', '#1D1B22'];
    for (let i = 0; i < 9; i++) { x.globalAlpha = 0.85; x.fillStyle = cols[i % cols.length]; x.beginPath(); x.ellipse(r() * w, r() * h, 20 + r() * 60, 14 + r() * 50, r() * 3, 0, Math.PI * 2); x.fill(); }
    x.globalAlpha = 1;
  }).t;
}

/* ---------- shared models (also used by the centre room) ---------- */
export function buildF1Car(parent, bodyColor = '#D32E26') {
  const car = new THREE.Group(); parent.add(car);
  const red = mat(bodyColor, 0.35, 0.25), carbon = mat('#23232A', 0.45, 0.35), tyre = mat('#111114', 0.92), rim = mat('#A2A8B0', 0.3, 0.85);
  box(1.3, 0.05, 3.4, carbon, 0, 0.14, -0.1, car);
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.27, 1.4, 20), red);
  nose.rotation.x = Math.PI / 2; nose.scale.set(1.25, 1, 0.62); nose.position.set(0, 0.36, 1.25); car.add(nose);
  box(0.74, 0.44, 1.35, red, 0, 0.42, 0.02, car, 0.1);
  box(0.46, 0.08, 0.6, mat('#0E0E12', 0.6), 0, 0.62, 0.12, car, 0.03);
  for (const s of [-1, 1]) { box(0.42, 0.36, 1.35, red, s * 0.56, 0.34, -0.28, car, 0.1); box(0.3, 0.2, 0.04, mat('#0E0E12', 0.6), s * 0.56, 0.37, 0.4, car); }
  const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.3, 1.45, 20), red);
  eng.rotation.x = -Math.PI / 2; eng.scale.set(1, 1, 1.35); eng.position.set(0, 0.56, -0.95); car.add(eng);
  box(0.26, 0.3, 0.32, red, 0, 0.84, -0.32, car, 0.06);
  box(0.03, 0.3, 0.85, red, 0, 0.86, -1.05, car);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 10, 28, Math.PI), carbon); halo.rotation.x = Math.PI / 2; halo.position.set(0, 0.8, -0.02); car.add(halo);
  box(1.78, 0.035, 0.34, carbon, 0, 0.13, 1.98, car);
  const fw2 = box(1.6, 0.03, 0.2, red, 0, 0.2, 1.86, car); fw2.rotation.x = -0.28;
  for (const s of [-1, 1]) box(0.03, 0.2, 0.42, carbon, s * 0.9, 0.2, 1.95, car);
  box(1.12, 0.04, 0.3, carbon, 0, 0.98, -1.78, car);
  const flap = box(1.12, 0.03, 0.2, red, 0, 1.07, -1.7, car); flap.rotation.x = -0.35;
  for (const s of [-1, 1]) box(0.03, 0.58, 0.52, red, s * 0.57, 0.88, -1.74, car);
  box(0.05, 0.4, 0.1, carbon, 0, 0.72, -1.74, car);
  const wheel = (x, z, r, w) => {
    const g = new THREE.Group(); g.position.set(x, r, z); car.add(g);
    const t = cyl(r, r, w, tyre, 0, 0, 0, g, 32); t.rotation.z = Math.PI / 2;
    const rm = cyl(r * 0.6, r * 0.6, w + 0.012, rim, 0, 0, 0, g, 24); rm.rotation.z = Math.PI / 2;
    box(Math.abs(x) - 0.3, 0.025, 0.05, carbon, -Math.sign(x) * (Math.abs(x) / 2 - 0.13), 0.05, 0, g);
  };
  wheel(-0.8, 1.25, 0.33, 0.32); wheel(0.8, 1.25, 0.33, 0.32); wheel(-0.83, -1.2, 0.36, 0.42); wheel(0.83, -1.2, 0.36, 0.42);
  return car;
}
function racket(parent, color) {
  const r = new THREE.Group(); parent.add(r);
  const frame = mat(color, 0.35, 0.3);
  const head = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.016, 8, 40), frame); head.scale.set(1, 1.28, 1); head.position.y = 0.42; r.add(head);
  const str = new THREE.Mesh(new THREE.CircleGeometry(0.195, 32), new THREE.MeshStandardMaterial({ map: netTex(), transparent: true, alphaTest: 0.2, side: THREE.DoubleSide }));
  str.scale.set(1, 1.28, 1); str.position.y = 0.42; r.add(str);
  cyl(0.011, 0.011, 0.36, mat('#2A2A30', 0.4, 0.6), 0, 0.05, 0, r, 8);
  cyl(0.034, 0.03, 0.4, mat('#F4F1EA', 0.8), 0, -0.3, 0, r, 12);
  return r;
}
function shuttle(parent, x, y, z, rx = 0, rz = 0) {
  const s = new THREE.Group(); s.position.set(x, y, z); s.rotation.set(rx, 0, rz); parent.add(s);
  const cork = sph(0.05, mat('#F4F0E6', 0.8), 0, 0, 0, s, 12); cork.scale.set(1, 0.8, 1);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.04, 0.16, 14, 1, true), mat('#FFFFFF', 0.7, 0, { side: THREE.DoubleSide })); skirt.position.y = 0.1; s.add(skirt);
  return s;
}
export function buildLegoBot(parent) {
  const bot = new THREE.Group(); parent.add(bot);
  const yel = mat('#F2C230', 0.45), blu = mat('#2F6FD6', 0.45);
  box(0.62, 0.12, 0.36, yel, 0, 0.16, 0, bot); box(0.36, 0.14, 0.3, blu, -0.06, 0.29, 0, bot);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) cyl(0.03, 0.03, 0.03, blu, -0.18 + i * 0.12, 0.375, -0.07 + j * 0.14, bot, 10);
  box(0.08, 0.1, 0.24, mat('#F3F3F3', 0.5), 0.33, 0.2, 0, bot);
  const wheels = [];
  for (const [wx, wz] of [[-0.2, -0.21], [-0.2, 0.21], [0.2, -0.21], [0.2, 0.21]]) { const wl = cyl(0.1, 0.1, 0.07, mat('#17171B', 0.9), wx, 0.1, wz, bot, 16); wl.rotation.x = Math.PI / 2; wheels.push(wl); }
  return { bot, wheels };
}
export function buildDrone(parent, topColor = '#C9DE3B') {
  const d = new THREE.Group(); parent.add(d);
  const blk = mat('#16161B', 0.8), metal = mat('#1E1D22', 0.5, 0.6);
  box(0.38, 0.1, 0.38, blk, 0, 0, 0, d, 0.04); box(0.26, 0.05, 0.26, mat(topColor, 0.5), 0, 0.07, 0, d, 0.03);
  const props = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2; const arm = box(0.42, 0.035, 0.05, blk, Math.cos(a) * 0.24, 0, Math.sin(a) * 0.24, d); arm.rotation.y = -a;
    const mx = Math.cos(a) * 0.43, mz = Math.sin(a) * 0.43; cyl(0.045, 0.045, 0.08, metal, mx, 0.03, mz, d, 10);
    props.push(box(0.36, 0.008, 0.04, mat('#E8E8E8', 0.5), mx, 0.08, mz, d));
    sph(0.02, glowMat('#46B8FF'), mx, -0.03, mz, d, 8);
  }
  return { d, props };
}

/* ---------- kit builders: (group, accentColor, seed, anims) ---------- */
export const B = {
  f1(g, c) {
    cyl(1.5, 1.55, 0.08, mat('#1C1B21', 0.5, 0.3), 0, 0.04, 0, g, 40);
    torus(1.52, 0.02, glowMat(c), 0, 0.08, 0, g, 64).rotation.x = Math.PI / 2;
    const car = buildF1Car(g, c); car.scale.setScalar(0.62); car.position.y = 0.08;
  },
  badminton(g, c) {
    for (const s of [-1, 1]) cyl(0.03, 0.03, 1.25, mat('#DADADA', 0.4, 0.5), s * 1.15, 0.62, -0.3, g, 8);
    const net = netTex().clone(); net.needsUpdate = true; net.repeat.set(4, 1);
    plane(2.3, 0.5, new THREE.MeshStandardMaterial({ map: net, transparent: true, side: THREE.DoubleSide, alphaTest: 0.1 }), 0, 1.0, -0.3, g);
    box(2.3, 0.04, 0.02, mat('#F5F5F5', 0.6), 0, 1.25, -0.3, g);
    const r = racket(g, c); r.position.set(0.4, 0.03, 0.6); r.rotation.set(-Math.PI / 2, 0, 0.6);
    const r2 = racket(g, '#2F2F36'); r2.position.set(-0.5, 0.03, 0.7); r2.rotation.set(-Math.PI / 2, 0, -0.9);
    shuttle(g, 0.1, 0.07, 1.1, 0, 1.3); shuttle(g, -0.9, 0.07, 0.2, 0, -1.2);
  },
  soccer(g, c) {
    const wm = mat('#F4F4F4', 0.4);
    for (const s of [-1, 1]) cyl(0.04, 0.04, 1.15, wm, s * 1.15, 0.575, -0.5, g, 10);
    const bar = cyl(0.04, 0.04, 2.34, wm, 0, 1.15, -0.5, g, 10); bar.rotation.z = Math.PI / 2;
    const net = netTex().clone(); net.needsUpdate = true; net.repeat.set(4, 2);
    const nm = new THREE.MeshStandardMaterial({ map: net, transparent: true, side: THREE.DoubleSide, alphaTest: 0.1 });
    const back = plane(2.3, 1.3, nm, 0, 0.55, -1.0, g); back.rotation.x = -0.35;
    const ball = sph(0.22, mat('#fff', 0.5, 0, { map: ballTex() }), 0.3, 0.22, 0.7, g, 24); ball.rotation.set(0.5, 0.9, 0);
    box(0.5, 0.02, 0.02, glowMat(c), 0, 0.01, 0.3, g);
  },
  basketball(g, c) {
    box(0.7, 0.18, 0.7, mat('#1E1D22', 0.6), 0, 0.09, -0.8, g);
    cyl(0.06, 0.06, 2.7, mat('#2A2A30', 0.4, 0.6), 0, 1.45, -0.8, g, 10);
    box(1.3, 0.85, 0.05, mat('#F5F5F2', 0.3), 0, 2.75, -0.62, g);
    box(0.44, 0.3, 0.052, mat(c, 0.5), 0, 2.6, -0.61, g);
    box(0.36, 0.22, 0.056, mat('#F5F5F2', 0.3), 0, 2.6, -0.61, g);
    torus(0.22, 0.018, mat('#E8602F', 0.4, 0.4), 0, 2.4, -0.36, g).rotation.x = Math.PI / 2;
    sph(0.2, mat('#E07A2E', 0.7), 0.5, 0.2, 0.6, g, 20);
  },
  climbing(g, c, seed) {
    const pg = new THREE.Group(); pg.position.set(0, 0, -1.0); pg.rotation.x = 0.18; g.add(pg);
    box(2.4, 3.4, 0.12, mat('#2B3445', 0.85), 0, 1.7, 0, pg);
    const r = rand(seed); const cols = ['#FF4FA3', '#FFD23F', '#54D17A', '#3FA7FF', c];
    for (let i = 0; i < 14; i++) { const h = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07 + r() * 0.07, 0), mat(cols[i % cols.length], 0.6, 0, { flatShading: true })); h.scale.set(1, 0.8, 0.55); h.position.set(-1 + r() * 2, 0.3 + r() * 2.9, 0.07); pg.add(h); }
    box(2.6, 0.3, 1.3, mat('#343A48', 0.9), 0, 0.15, 0.1, g, 0.08);
  },
  guitar(g, c) {
    const gt = new THREE.Group(); gt.position.set(0, 0.25, 0); gt.rotation.x = -0.18; g.add(gt);
    const bodyM = mat(c, 0.35, 0.1);
    const lower = sph(0.38, bodyM, 0, 0.45, 0, gt, 28); lower.scale.set(1, 1, 0.28);
    const upper = sph(0.29, bodyM, 0, 0.95, 0, gt, 28); upper.scale.set(1, 1, 0.28);
    const hole = cyl(0.1, 0.1, 0.02, mat('#141414', 0.9), 0, 0.72, 0.1, gt, 20); hole.rotation.x = Math.PI / 2;
    box(0.09, 1.0, 0.05, mat('#4A2E1F', 0.6), 0, 1.6, 0.03, gt); box(0.14, 0.24, 0.05, mat('#2A1A12', 0.6), 0, 2.2, 0.03, gt);
    box(0.5, 0.05, 0.4, mat('#1E1D22', 0.6), 0, 0.03, 0.05, g);
    rod([0, 0.05, -0.1], [0, 0.9, -0.25], 0.02, mat('#1E1D22', 0.6), g);
    const amp = box(0.7, 0.6, 0.4, mat('#1C1B20', 0.7), 1.0, 0.3, -0.3, g, 0.04);
    box(0.56, 0.36, 0.01, mat('#3A3540', 0.9), 1.0, 0.32, -0.095, g);
  },
  piano(g, c) {
    const dark = mat('#17161B', 0.5, 0.2);
    for (const s of [-1, 1]) { const l = box(0.05, 1.05, 0.05, dark, s * 0.6, 0.5, 0, g); l.rotation.z = s * 0.45; const l2 = box(0.05, 1.05, 0.05, dark, s * 0.6, 0.5, 0, g); l2.rotation.z = -s * 0.45; }
    box(1.9, 0.12, 0.5, dark, 0, 1.02, 0, g, 0.03);
    const k = plane(1.72, 0.3, new THREE.MeshStandardMaterial({ map: keysTex(), roughness: 0.4 }), 0, 1.085, 0.06, g); k.rotation.x = -Math.PI / 2;
    box(1.9, 0.02, 0.03, glowMat(c), 0, 1.02, 0.26, g);
    cyl(0.25, 0.25, 0.08, mat(c, 0.6), 0, 0.62, 0.9, g, 20); cyl(0.04, 0.04, 0.6, dark, 0, 0.3, 0.9, g, 8);
  },
  dj(g, c, seed, anims) {
    const dark = mat('#141318', 0.6);
    box(1.9, 0.85, 0.8, dark, 0, 0.425, 0, g, 0.03);
    const plats = [];
    for (const s of [-1, 1]) { box(0.7, 0.06, 0.62, mat('#2A2830', 0.5, 0.4), s * 0.52, 0.88, 0, g); const p = cyl(0.26, 0.26, 0.03, mat('#0B0B0E', 0.4), s * 0.52, 0.93, 0, g, 28); plats.push(p); cyl(0.08, 0.08, 0.035, glowMat(c), s * 0.52, 0.94, 0, g, 16); }
    box(0.26, 0.05, 0.5, mat('#33303A', 0.5), 0, 0.89, 0, g);
    for (const s of [-1, 1]) { box(0.5, 1.2, 0.45, dark, s * 1.35, 0.6, -0.2, g, 0.04); const cone = cyl(0.17, 0.17, 0.02, mat('#2B2A30', 0.6), s * 1.35, 0.45, 0.04, g, 20); cone.rotation.x = Math.PI / 2; const tw = cyl(0.08, 0.08, 0.02, mat('#2B2A30', 0.6), s * 1.35, 0.95, 0.04, g, 16); tw.rotation.x = Math.PI / 2; }
    box(1.9, 0.02, 0.02, glowMat(c), 0, 0.1, 0.41, g);
    anims.push(dt => plats.forEach(p => p.rotation.y += dt * 3.5));
  },
  books(g, c, seed) {
    const wood = mat('#6E4530', 0.6);
    box(2.0, 2.6, 0.06, wood, 0, 1.3, -0.25, g);
    for (const s of [-1, 1]) box(0.06, 2.6, 0.5, wood, s * 0.97, 1.3, 0, g);
    const r = rand(seed); const cols = [c, '#2F6FD6', '#F2C14E', '#E8402F', '#2CC4B3', '#EDE3CF', '#6B4E9B'];
    for (let sh = 0; sh < 4; sh++) {
      const y = 0.05 + sh * 0.64; box(1.9, 0.05, 0.5, wood, 0, y, 0, g);
      let x = -0.88; while (x < 0.8) { const w = 0.07 + r() * 0.07, h = 0.36 + r() * 0.18; box(w, h, 0.36, mat(cols[Math.floor(r() * cols.length)], 0.7), x + w / 2, y + 0.025 + h / 2, 0.02, g); x += w + 0.01; if (r() > 0.93) x += 0.15; }
    }
  },
  plant(g) {
    const pot = mat('#B5653A', 0.8), leaf = mat('#3E8E4A', 0.6), leaf2 = mat('#5DB36A', 0.6);
    const big = (x, z, s) => {
      cyl(0.36 * s, 0.28 * s, 0.6 * s, pot, x, 0.3 * s, z, g, 20); cyl(0.33 * s, 0.33 * s, 0.03, mat('#3A2A1E', 0.9), x, 0.6 * s, z, g, 20);
      for (let i = 0; i < 8; i++) { const a = i * 0.8, h = (0.9 + (i % 3) * 0.35) * s; rod([x, 0.55 * s, z], [x + Math.cos(a) * 0.35 * s, h, z + Math.sin(a) * 0.35 * s], 0.012, leaf, g); const L = sph(0.26 * s, i % 2 ? leaf : leaf2, x + Math.cos(a) * 0.45 * s, h + 0.05, z + Math.sin(a) * 0.45 * s, g, 12); L.scale.set(1, 0.18, 0.55); L.rotation.y = -a; L.rotation.z = 0.4; }
    };
    big(0, 0, 1.2); big(0.95, 0.7, 0.7); big(-0.8, 0.6, 0.55);
  },
  gaming(g, c) {
    const blk = mat('#16161B', 0.7), metal = mat('#1E1D22', 0.5, 0.6);
    box(2.0, 0.08, 0.85, blk, 0, 1.0, -0.4, g, 0.02);
    for (const s of [-1, 1]) box(0.06, 1.0, 0.7, metal, s * 0.9, 0.5, -0.4, g);
    box(1.3, 0.72, 0.05, blk, 0, 1.55, -0.72, g, 0.02);
    plane(1.24, 0.66, screenMat(gameTex(c)), 0, 1.55, -0.692, g);
    box(0.08, 0.2, 0.08, metal, 0, 1.13, -0.74, g);
    box(0.7, 0.03, 0.22, blk, -0.1, 1.055, -0.25, g); box(0.7, 0.012, 0.012, glowMat(c), -0.1, 1.04, -0.14, g);
    box(2.0, 0.015, 0.015, glowMat(c), 0, 0.96, 0.02, g);
    box(0.7, 0.16, 0.7, mat(c, 0.7), 0, 0.62, 0.55, g, 0.07);
    const bk = box(0.7, 1.05, 0.16, mat('#141318', 0.8), 0, 1.15, 0.9, g, 0.07); bk.rotation.x = 0.15;
    box(0.5, 0.06, 0.5, metal, 0, 0.3, 0.55, g); cyl(0.05, 0.05, 0.3, metal, 0, 0.42, 0.55, g, 8);
  },
  coding(g, c) {
    const wood = mat('#8A6446', 0.6), metal = mat('#1E1D22', 0.5, 0.6);
    box(2.0, 0.07, 0.9, wood, 0, 1.0, -0.35, g, 0.02);
    for (const [x, z] of [[-0.92, -0.72], [0.92, -0.72], [-0.92, 0.02], [0.92, 0.02]]) box(0.06, 1.0, 0.06, metal, x, 0.5, z, g);
    box(0.8, 0.03, 0.55, mat('#B9BEC6', 0.35, 0.7), -0.2, 1.05, -0.3, g, 0.012);
    const lid = new THREE.Group(); lid.position.set(-0.2, 1.06, -0.57); lid.rotation.x = -0.28; g.add(lid);
    box(0.8, 0.52, 0.02, mat('#B9BEC6', 0.35, 0.7), 0, 0.26, 0, lid, 0.01); plane(0.74, 0.46, screenMat(termTex()), 0, 0.27, 0.012, lid);
    cyl(0.07, 0.06, 0.16, mat(c, 0.5), 0.6, 1.12, -0.2, g, 16);
    rod([0.75, 1.04, -0.65], [0.75, 1.6, -0.55], 0.015, metal, g); const shade = cyl(0.05, 0.14, 0.14, mat(c, 0.5, 0, { emissive: c, emissiveIntensity: 0.4 }), 0.75, 1.62, -0.45, g, 16); shade.rotation.x = 0.6;
    box(0.6, 0.12, 0.6, mat('#2A2830', 0.8), 0, 0.55, 0.45, g, 0.05);
    const bk = box(0.6, 0.8, 0.1, mat('#2A2830', 0.8), 0, 1.0, 0.72, g, 0.04); bk.rotation.x = 0.12;
  },
  robot(g, c, seed, anims) {
    const { bot, wheels } = buildLegoBot(g); bot.scale.setScalar(1.6);
    const base = cyl(0.3, 0.35, 0.2, mat('#2A2830', 0.6), 0.6, 0.1, -0.6, g, 20);
    const arm = new THREE.Group(); arm.position.set(0.6, 0.2, -0.6); g.add(arm);
    box(0.14, 0.9, 0.14, mat(c, 0.5), 0, 0.45, 0, arm); const fore = box(0.1, 0.7, 0.1, mat('#F2F2F2', 0.5), 0, 1.05, 0.25, arm); fore.rotation.x = 0.8;
    sph(0.08, mat('#2A2830', 0.5), 0, 0.9, 0, arm, 12);
    let t = hashStr(String(seed)) % 7;
    anims.push(dt => { t += dt; bot.position.set(Math.cos(t * 0.6) * 0.7, 0, 0.6 + Math.sin(t * 0.6) * 0.4); bot.rotation.y = -t * 0.6 - Math.PI / 2; wheels.forEach(w => w.rotation.y += dt * 5); arm.rotation.y = Math.sin(t * 0.8) * 0.8; });
  },
  drone(g, c, seed, anims) {
    const pad = cyl(0.7, 0.7, 0.04, mat('#2A2830', 0.7), 0, 0.02, 0, g, 32);
    torus(0.6, 0.02, glowMat(c), 0, 0.045, 0, g, 48).rotation.x = Math.PI / 2;
    box(0.08, 0.005, 0.5, mat('#F2F2F2', 0.6), -0.15, 0.045, 0, g); box(0.08, 0.005, 0.5, mat('#F2F2F2', 0.6), 0.15, 0.045, 0, g); box(0.3, 0.005, 0.08, mat('#F2F2F2', 0.6), 0, 0.045, 0, g);
    const { d, props } = buildDrone(g, c); d.scale.setScalar(1.3);
    let t = (hashStr(String(seed)) % 100) / 10;
    anims.push(dt => { t += dt; d.position.set(0, 1.4 + Math.sin(t * 1.3) * 0.2, 0); d.rotation.y = t * 0.3; props.forEach(p => p.rotation.y += dt * 40); });
  },
  camera(g, c) {
    const metal = mat('#1E1D22', 0.5, 0.6);
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; rod([0, 1.3, 0], [Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5], 0.02, metal, g); }
    box(0.42, 0.28, 0.22, mat('#1A1A1F', 0.5), 0, 1.47, 0, g, 0.03);
    const lens = cyl(0.1, 0.11, 0.26, mat('#2A2A30', 0.3, 0.5), 0, 1.47, 0.22, g, 20); lens.rotation.x = Math.PI / 2;
    const glass = cyl(0.075, 0.075, 0.01, mat('#3A5A8A', 0.05, 0.8), 0, 1.47, 0.355, g, 20); glass.rotation.x = Math.PI / 2;
    box(0.1, 0.05, 0.05, mat(c, 0.5), 0.12, 1.64, 0, g);
    sph(0.025, glowMat('#FF3B3B'), -0.15, 1.58, 0.1, g, 8);
    const soft = box(0.8, 0.8, 0.3, mat('#F5F2EA', 0.8, 0, { emissive: '#FFF3DC', emissiveIntensity: 0.35 }), -1.0, 1.8, -0.4, g, 0.04); soft.rotation.y = 0.6;
    rod([-1.0, 1.4, -0.4], [-1.0, 0, -0.4], 0.02, metal, g);
  },
  art(g, c, seed) {
    const wood = mat('#8A6446', 0.7);
    rod([-0.45, 0, 0.2], [-0.1, 2.0, 0], 0.03, wood, g); rod([0.45, 0, 0.2], [0.1, 2.0, 0], 0.03, wood, g); rod([0, 0, -0.55], [0, 1.95, -0.02], 0.03, wood, g);
    box(0.9, 0.04, 0.12, wood, 0, 0.75, 0.13, g);
    const cv = plane(0.8, 1.0, new THREE.MeshStandardMaterial({ map: artTex(c, seed), roughness: 0.9 }), 0, 1.3, 0.1, g); cv.rotation.x = -0.1;
    box(0.82, 1.02, 0.03, mat('#EFE8DA', 0.9), 0, 1.3, 0.08, g).rotation.x = -0.1;
    const pal = cyl(0.3, 0.3, 0.02, mat('#C9A27A', 0.7), 0.7, 0.02, 0.6, g, 20); pal.scale.set(1, 1, 0.75);
    [c, '#2F6FD6', '#F2C14E', '#E8402F'].forEach((k, i) => sph(0.04, mat(k, 0.5), 0.6 + (i % 2) * 0.15, 0.04, 0.5 + Math.floor(i / 2) * 0.15, g, 8));
  },
  space(g, c) {
    const metal = mat('#1E1D22', 0.5, 0.6);
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; rod([0, 1.1, 0], [Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55], 0.025, metal, g); }
    const tube = cyl(0.12, 0.1, 1.5, mat('#F2F2F2', 0.35, 0.3), 0, 1.45, -0.1, g, 20); tube.rotation.x = -0.9;
    const ring = cyl(0.13, 0.13, 0.08, mat(c, 0.4), 0, 1.75, -0.47, g, 20); ring.rotation.x = -0.9;
    const planet = sph(0.28, mat('#E7B46A', 0.6), 1.0, 1.05, 0.5, g, 24);
    const pr = torus(0.45, 0.04, mat(c, 0.5), 1.0, 1.05, 0.5, g, 48); pr.rotation.x = Math.PI / 2 - 0.4; pr.scale.set(1, 1, 0.2);
    rod([1.0, 0, 0.5], [1.0, 0.77, 0.5], 0.02, metal, g); cyl(0.2, 0.2, 0.04, metal, 1.0, 0.02, 0.5, g, 16);
  },
  bike(g, c) {
    const fr = mat(c, 0.35, 0.3), tyre = mat('#141414', 0.9), metal = mat('#9AA0A8', 0.3, 0.8);
    for (const z of [-0.62, 0.62]) { const w = torus(0.36, 0.035, tyre, 0, 0.38, z, g, 36); w.rotation.y = Math.PI / 2; const hb = cyl(0.03, 0.03, 0.1, metal, 0, 0.38, z, g, 8); hb.rotation.z = Math.PI / 2; }
    const P = { rear: [0, 0.38, -0.62], front: [0, 0.38, 0.62], crank: [0, 0.4, -0.05], seat: [0, 0.95, -0.3], head: [0, 0.98, 0.45] };
    rod(P.rear, P.crank, 0.025, fr, g); rod(P.crank, P.seat, 0.028, fr, g); rod(P.seat, P.rear, 0.022, fr, g); rod(P.seat, P.head, 0.028, fr, g); rod(P.crank, P.head, 0.03, fr, g); rod(P.head, P.front, 0.025, fr, g);
    box(0.12, 0.05, 0.28, mat('#141414', 0.7), 0, 1.02, -0.32, g, 0.02);
    const hbar = cyl(0.018, 0.018, 0.5, metal, 0, 1.1, 0.5, g, 8); hbar.rotation.z = Math.PI / 2; rod(P.head, [0, 1.1, 0.5], 0.02, metal, g);
    cyl(0.1, 0.1, 0.02, metal, 0.03, 0.4, -0.05, g, 16).rotation.z = Math.PI / 2;
  },
  skate(g, c) {
    const ramp = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2.2, 24, 1, true, Math.PI, Math.PI / 2), mat('#C9A27A', 0.8, 0, { side: THREE.DoubleSide }));
    ramp.rotation.z = Math.PI / 2; ramp.position.set(0, 1.2, -1.2 + 0.0); ramp.scale.set(1, 1, 1); g.add(ramp);
    box(2.2, 0.05, 0.4, mat('#9A7A5A', 0.8), 0, 1.2, -1.4, g);
    box(2.24, 0.05, 0.05, glowMat(c), 0, 1.22, -1.2, g);
    const sk = new THREE.Group(); sk.position.set(0.4, 0.12, 0.7); sk.rotation.y = 0.5; g.add(sk);
    box(0.24, 0.035, 0.85, mat(c, 0.5), 0, 0.02, 0, sk, 0.015); box(0.24, 0.005, 0.8, mat('#141414', 0.95), 0, 0.04, 0, sk);
    for (const [x, z] of [[-0.09, -0.3], [0.09, -0.3], [-0.09, 0.3], [0.09, 0.3]]) { const w = cyl(0.035, 0.035, 0.035, mat('#F2EDE3', 0.5), x, -0.06, z, sk, 12); w.rotation.z = Math.PI / 2; }
  },
  chess(g, c) {
    const wood = mat('#6E4530', 0.6);
    cyl(0.55, 0.55, 0.06, wood, 0, 0.75, 0, g, 32); cyl(0.06, 0.06, 0.72, wood, 0, 0.37, 0, g, 10); cyl(0.3, 0.3, 0.04, wood, 0, 0.02, 0, g, 20);
    const b = plane(0.72, 0.72, new THREE.MeshStandardMaterial({ map: chess8Tex(), roughness: 0.6 }), 0, 0.785, 0, g); b.rotation.x = -Math.PI / 2;
    const wht = mat('#F2EDE3', 0.4), blk = mat('#1D1B22', 0.4), r = rand(5);
    for (let i = 0; i < 10; i++) { const m = i % 2 ? wht : blk; const x = -0.3 + Math.floor(r() * 8) * 0.09, z = -0.3 + Math.floor(r() * 8) * 0.09; cyl(0.025, 0.03, 0.08 + (i === 0 ? 0.06 : 0), m, x, 0.83, z, g, 10); sph(0.022, m, x, 0.89 + (i === 0 ? 0.06 : 0), z, g, 8); }
    for (const s of [-1, 1]) { cyl(0.22, 0.22, 0.06, mat(c, 0.6), s * 0.95, 0.5, 0, g, 16); cyl(0.04, 0.04, 0.48, wood, s * 0.95, 0.24, 0, g, 8); }
  },
  gym(g, c) {
    const metal = mat('#2A2A30', 0.4, 0.7), plate = mat('#141414', 0.6);
    box(0.4, 0.1, 1.3, mat('#1B1A20', 0.7), 0, 0.5, 0.2, g, 0.04); box(0.06, 0.45, 0.06, metal, 0, 0.22, -0.3, g); box(0.06, 0.45, 0.06, metal, 0, 0.22, 0.7, g);
    for (const s of [-1, 1]) box(0.08, 1.4, 0.08, metal, s * 0.7, 0.7, -0.45, g);
    const bar = cyl(0.025, 0.025, 2.0, mat('#C9CED6', 0.3, 0.9), 0, 1.25, -0.4, g, 10); bar.rotation.z = Math.PI / 2;
    for (const s of [-1, 1]) { const p = cyl(0.28, 0.28, 0.07, plate, s * 0.85, 1.25, -0.4, g, 24); p.rotation.z = Math.PI / 2; const p2 = cyl(0.2, 0.2, 0.05, mat(c, 0.5), s * 0.93, 1.25, -0.4, g, 20); p2.rotation.z = Math.PI / 2; }
    for (const x of [0.65, 0.95]) { const db = new THREE.Group(); db.position.set(x, 0.08, 0.9); g.add(db); const h = cyl(0.02, 0.02, 0.3, metal, 0, 0, 0, db, 8); h.rotation.z = Math.PI / 2; for (const s of [-1, 1]) { const e = cyl(0.08, 0.08, 0.08, plate, s * 0.15, 0, 0, db, 12); e.rotation.z = Math.PI / 2; } }
  },
  coffee(g, c) {
    box(2.0, 1.0, 0.7, mat('#6E4530', 0.6), 0, 0.5, -0.3, g, 0.03); box(2.04, 0.05, 0.74, mat('#EDE8E0', 0.3), 0, 1.025, -0.3, g);
    const steel = mat('#C9CED6', 0.25, 0.9);
    box(0.55, 0.5, 0.42, steel, -0.4, 1.3, -0.38, g, 0.04); box(0.55, 0.08, 0.42, mat(c, 0.5), -0.4, 1.5, -0.38, g, 0.02);
    cyl(0.05, 0.05, 0.12, mat('#2A2A30', 0.4, 0.6), -0.4, 1.12, -0.13, g, 12);
    cyl(0.05, 0.04, 0.08, mat('#F5F5F2', 0.4), -0.4, 1.09, -0.1, g, 14);
    const grinder = cyl(0.08, 0.12, 0.3, mat('#1A1A1F', 0.5), 0.3, 1.2, -0.45, g, 16); cyl(0.12, 0.05, 0.18, mat('#6B4A2B', 0.3, 0, { transparent: true, opacity: 0.8 }), 0.3, 1.44, -0.45, g, 16);
    for (let i = 0; i < 3; i++) { cyl(0.05, 0.045, 0.09, mat(i === 1 ? c : '#F5F5F2', 0.4), 0.55 + i * 0.14, 1.095, -0.1, g, 14); }
    for (const s of [-1, 1]) { cyl(0.18, 0.18, 0.05, mat(c, 0.6), s * 0.5, 0.8, 0.45, g, 16); cyl(0.03, 0.03, 0.78, mat('#1E1D22', 0.5, 0.6), s * 0.5, 0.39, 0.45, g, 8); }
  },
  cat(g, c, seed, anims) {
    const bed = torus(0.45, 0.16, mat(c, 0.9), 0, 0.14, 0, g, 32); bed.rotation.x = Math.PI / 2;
    cyl(0.42, 0.42, 0.08, mat('#EFE6D8', 0.95), 0, 0.06, 0, g, 24);
    const fur = mat('#E08A3A', 0.8), catG = new THREE.Group(); catG.position.set(0, 0.12, 0); g.add(catG);
    const body = sph(0.26, fur, 0, 0.16, 0, catG, 20); body.scale.set(1, 0.7, 1.25);
    const head = sph(0.16, fur, 0.02, 0.26, 0.3, catG, 18);
    for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.1, 4), fur); ear.position.set(s * 0.08, 0.4, 0.3); catG.add(ear); sph(0.018, mat('#1A1A1A', 0.3), s * 0.06, 0.29, 0.44, catG, 8); }
    const tail = torus(0.2, 0.04, fur, -0.15, 0.08, -0.1, catG, 20, Math.PI); tail.rotation.x = Math.PI / 2;
    sph(0.07, mat('#F2F2F2', 0.6), 0.55, 0.07, 0.4, g, 12);
    let t = seed % 10;
    anims.push(dt => { t += dt; body.scale.y = 0.7 + Math.sin(t * 2) * 0.03; tail.rotation.z = Math.sin(t * 1.2) * 0.3; });
  }
};

export const SLOTS = [
  [0.3, 0.8, Math.PI / 4],
  [0.2, -3.5, 0],
  [-3.3, -3.3, Math.PI / 4],
  [3.3, -3.4, 0],
  [-3.5, 0.4, Math.PI / 2],
  [-3.2, 3.5, Math.PI / 2],
  [3.4, 3.3, Math.PI / 4],
  [3.5, -0.2, 0]
];

export function neonSign(text, color, fontFamily) {
  const t = canvasTex(1024, 220, (x, w, h) => {
    x.clearRect(0, 0, w, h); x.textAlign = 'center'; x.textBaseline = 'middle';
    let size = 130; x.font = `700 ${size}px ${fontFamily}`;
    while (x.measureText(text.toUpperCase()).width > w - 60 && size > 40) { size -= 6; x.font = `700 ${size}px ${fontFamily}`; }
    x.shadowColor = color; x.shadowBlur = 36; x.fillStyle = color; x.fillText(text.toUpperCase(), w / 2, h / 2);
    x.shadowBlur = 10; x.fillStyle = '#FFFFFF'; x.globalAlpha = 0.85; x.fillText(text.toUpperCase(), w / 2, h / 2);
  }).t;
  return new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false, depthWrite: false });
}
export function initialPoster(title, bio, color, fontFamily) {
  return canvasTex(400, 560, (x, w, h) => {
    x.fillStyle = '#16151B'; x.fillRect(0, 0, w, h);
    x.fillStyle = color; x.globalAlpha = 0.9; x.beginPath(); x.arc(w / 2, 220, 150, 0, Math.PI * 2); x.fill(); x.globalAlpha = 1;
    x.fillStyle = '#16151B'; x.font = `700 200px ${fontFamily}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText((title.trim()[0] || '?').toUpperCase(), w / 2, 232);
    x.fillStyle = '#F3EFE8'; x.font = `600 30px ${fontFamily}`; x.textBaseline = 'alphabetic'; x.fillText(title.slice(0, 22), w / 2, 430);
    x.fillStyle = '#ADA7B5'; x.font = '18px system-ui'; const words = bio.split(/\s+/); let line = '', y = 470;
    for (const wd of words) { const test = line ? line + ' ' + wd : wd; if (x.measureText(test).width > w - 50) { x.fillText(line, w / 2, y); line = wd; y += 24; if (y > 540) break; } else line = test; }
    if (y <= 540 && line) x.fillText(line, w / 2, y);
  }).t;
}

// free a room's graphics memory. Shapes and textures that other rooms share are kept, so nothing else
// has to be sent to the graphics card again.
export function disposeGroup(g) {
  g.traverse(o => {
    if (!o.isMesh && !o.isSprite) return;
    if (o.isMesh && !o.geometry?.userData.shared) o.geometry?.dispose();
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    ms.forEach(m => { if (!m) return; if (m.map && !m.map.userData.shared && !Object.values(cache).includes(m.map)) m.map.dispose(); m.dispose(); });
  });
  g.parent?.remove(g);
}
