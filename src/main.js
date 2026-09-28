import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './style.css';
import { canvasTex } from './three-helpers.js';
import { disposeGroup } from './kit.js';
import { createHomeRoom, HOT, HOT_BY_ID, KIND, HOME_NAME, HOME_BIO, HOME_SLUG } from './homeRoom.js';
import { parseRoomCode, buildRecipeRoom, DEEP_PROMPT } from './recipe.js';
import { createBackend } from './backend.js';
import { bakeRoom, farLayer, sampleColors } from './farView.js';
import * as roomCache from './roomCache.js';
import { inject } from '@vercel/analytics';

// Initialize Vercel Web Analytics
inject();

/* ---------- Cubby ---------- */
const S = 13, HOME = '0_0', GRID = '#3DFFB0';
const MIN_R = 3, MAX_R = 60; // the grid starts 7 x 7 and grows a ring at a time as rooms fill it
let gridR = MIN_R;
const ring = k => { const [px, pz] = parseKey(k); return Math.max(Math.abs(px), Math.abs(pz)); };
const LIFT = 8; // the room in focus floats about one room-height above the grid
const keyOf = (px, pz) => `${px}_${pz}`;
const parseKey = k => k.split('_').map(Number);
const posOf = k => { const [px, pz] = parseKey(k); return new THREE.Vector3(px * S, 0, pz * S); };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const touch = matchMedia('(pointer: coarse)').matches;
const $ = id => document.getElementById(id);

let rooms = [];      // saved rooms: recipe fields + owner, px, pz
let backend = null;
let myRoom = null;

/* ---------- renderer / scene ---------- */
const canvas = $('scene');
// sharp screens (retina) already look smooth, so they skip the costly anti-aliasing
const DEVICE_PX = Math.min(window.devicePixelRatio || 1, 2);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: DEVICE_PX < 1.5, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(DEVICE_PX);
renderer.shadowMap.enabled = true;
renderer.shadowMap.autoUpdate = false; // shadows are redrawn only when something moves (see the loop)
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#070B0A');
scene.fog = new THREE.Fog('#070B0A', 90, 240);
const camera = new THREE.PerspectiveCamera(30, 1, 0.3, 500);
const controls = new OrbitControls(camera, canvas);
Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, enablePan: false, minAzimuthAngle: 0.06, maxAzimuthAngle: Math.PI / 2 - 0.06, minPolarAngle: 0.3, maxPolarAngle: 1.42, minDistance: 2.5, maxDistance: 230, screenSpacePanning: false });
// grid mode: drag to slide around the grid like a map (right-drag or two fingers to turn).
// room mode: drag to turn around the room, no sliding.
function setControlMode(grid) {
  controls.enablePan = grid;
  controls.mouseButtons = grid ? { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE } : { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  controls.touches = grid ? { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE } : { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
}
const panLimit = () => (gridR + 0.5) * S;
const panShift = new THREE.Vector3();
const ROOM_REACH = 5.25; // how far from a room's middle the point you look at may go (half a room)
// keep the point you look at in bounds: on the grid while you slide around it, inside the room while you zoom around it
function clampPan() {
  const t = controls.target, clamp = THREE.MathUtils.clamp;
  if (focusPlot === null) { const L = panLimit(); panShift.set(clamp(t.x, -L, L) - t.x, -t.y, clamp(t.z, -L, L) - t.z); }
  else { const [px, pz] = parseKey(focusPlot), R = ROOM_REACH; panShift.set(clamp(t.x, px * S - R, px * S + R) - t.x, clamp(t.y, LIFT, LIFT + 5) - t.y, clamp(t.z, pz * S - R, pz * S + R) - t.z); }
  if (panShift.lengthSq() > 1e-8) { t.add(panShift); camera.position.add(panShift); }
}
const DIR = new THREE.Vector3(1, 0.78, 1).normalize();
const ROOM_DIR = new THREE.Vector3(1, 0.5, 1).normalize();
const OBJ_DIR = new THREE.Vector3(0.6, 0.55, 1).normalize();
const hemi = new THREE.HemisphereLight('#B7C8FF', '#2E3A30', 0.9); scene.add(hemi);
const key = new THREE.DirectionalLight('#FFE1BE', 1.4);
key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 55 });
key.shadow.bias = -0.0005; key.shadow.normalBias = 0.03;
scene.add(key, key.target);
function aimShadow(c) { key.position.copy(c).add(new THREE.Vector3(10, 16, 9)); key.target.position.copy(c); }
aimShadow(new THREE.Vector3());
const homeRoot = new THREE.Group(); scene.add(homeRoot);

/* glowing floor */
const groundMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uS: { value: S }, uR: { value: (MIN_R + 0.5) * S }, uCol: { value: new THREE.Color(GRID) }, uBg: { value: new THREE.Color('#070B0A') }, uDim: { value: 0 } },
  vertexShader: `#include <common>
    #include <logdepthbuf_pars_vertex>
    varying vec3 vW;
    void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w;
    #include <logdepthbuf_vertex>
    }`,
  fragmentShader: `
    #include <logdepthbuf_pars_fragment>
    varying vec3 vW; uniform float uTime, uS, uR, uDim; uniform vec3 uCol, uBg;
    float hash(float n){ return fract(sin(n)*43758.5453); }
    void main(){
      #include <logdepthbuf_fragment>
      vec2 p = vW.xz;
      vec2 d = abs(fract(p / uS) - 0.5) * uS;
      float major = 1.0 - smoothstep(0.03, 0.16, min(d.x, d.y));
      vec2 f = abs(fract(p) - 0.5);
      float minor = 1.0 - smoothstep(0.0, 0.03, 0.5 - max(f.x, f.y));
      float lx = floor(p.x / uS + 0.5), lz = floor(p.y / uS + 0.5);
      float px = pow(0.5 + 0.5 * sin(p.y * 0.35 - uTime * 2.2 + hash(lx) * 40.0), 28.0) * step(d.x, 0.16);
      float pz = pow(0.5 + 0.5 * sin(p.x * 0.35 - uTime * 1.7 + hash(lz + 9.0) * 40.0), 28.0) * step(d.y, 0.16);
      float edge = max(abs(p.x), abs(p.y));
      float fade = 1.0 - smoothstep(uR - 2.0, uR + 26.0, edge);
      vec3 c = uBg + uCol * (major * 0.45 + minor * 0.05 + (px + pz) * 1.4) * fade;
      c *= 1.0 - uDim;
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
});
const ground = new THREE.Mesh(new THREE.PlaneGeometry(620, 620), groundMat);
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.42; scene.add(ground);

/* digital rain along the grid lines */
const RAIN = 1000;
const rain = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 1.6, 0.05), new THREE.MeshBasicMaterial({ color: GRID, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), RAIN);
const drops = []; const dummy = new THREE.Object3D();
function placeDrop(d) { // a drop runs down one of the grid lines
  const R = gridR, along = (Math.random() - 0.5) * (R * 2 + 6) * S;
  const line = (Math.floor(Math.random() * (R * 2 + 2)) - R - 0.5) * S;
  const onX = Math.random() < 0.5; d.x = onX ? line : along; d.z = onX ? along : line;
}
for (let i = 0; i < RAIN; i++) { const d = { y: Math.random() * 40, v: 4 + Math.random() * 8 }; placeDrop(d); drops.push(d); }
scene.add(rain);
function stepRain(dt) { for (let i = 0; i < rain.count; i++) { const d = drops[i]; d.y -= d.v * dt; if (d.y < -0.5) { d.y = 30 + Math.random() * 20; placeDrop(d); } dummy.position.set(d.x, d.y, d.z); dummy.updateMatrix(); rain.setMatrixAt(i, dummy.matrix); } rain.instanceMatrix.needsUpdate = true; }
rain.count = 320;
stepRain(0);

/* focus fade: everything except the room in focus goes to black */
const BG = new THREE.Color('#070B0A'), BLACK = new THREE.Color('#000000');
const TRANS_MS = 2000;   // rise, fade and camera move all share this one clock
let trans = null;        // { t0, from: Map(key -> { lift, dim }), g }
function startTrans() {
  if (reduced) { trans = null; return; }
  const from = new Map(); places.forEach((pl, k) => from.set(k, { lift: pl.lift, dim: pl.dim }));
  trans = { t0: performance.now(), from, g: groundMat.uniforms.uDim.value };
}

/* squares: hit boxes + empty wireframes */
const hitboxes = []; const hitByKey = new Map(); const empties = new Map();
const edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(10.5, 6.9, 10.5));
const hitGeo = new THREE.BoxGeometry(10.6, 7.4, 10.6); const hitMat = new THREE.MeshBasicMaterial({ visible: false });
function makeSquare(k) {
  const p = posOf(k);
  const hb = new THREE.Mesh(hitGeo, hitMat); hb.position.set(p.x, 3.4, p.z); hb.userData.plot = k; scene.add(hb); hitByKey.set(k, hb);
  if (k === HOME) return;
  const m = new THREE.LineBasicMaterial({ color: GRID, transparent: true, opacity: 0, depthWrite: false });
  const e = new THREE.LineSegments(edgeGeo, m); e.position.set(p.x - 0.05, 3.05, p.z - 0.05); scene.add(e);
  empties.set(k, { lines: e, hot: false });
}
// grow (or shrink) the grid: squares, floor glow, rain, fog and camera range all follow
function setGridR(R) {
  gridR = Math.max(MIN_R, Math.min(MAX_R, R));
  hitboxes.length = 0;
  for (let px = -gridR; px <= gridR; px++) for (let pz = -gridR; pz <= gridR; pz++) { const k = keyOf(px, pz); if (!hitByKey.has(k)) makeSquare(k); hitboxes.push(hitByKey.get(k)); }
  empties.forEach((e, k) => { if (ring(k) > gridR) e.lines.visible = false; });
  groundMat.uniforms.uR.value = (gridR + 0.5) * S;
  ground.scale.setScalar(Math.max(1, (2 * (gridR + 0.5) * S + 140) / 620));
  rain.count = Math.min(RAIN, Math.round(320 * ((2 * gridR + 1) / 9) ** 2));
  fitRange();
}

/* ---------- places (rooms that exist in the world) ----------
   A guest room has two layers under its root: "far", the baked version (farView.js: a handful of draw calls,
   cached in the browser), and "detail", the full room, which only the rooms nearest the camera get. Detail is
   built in the background, warmed up on the graphics card, and swapped in only once it's ready (see "jobs"). */
const places = new Map(); // key -> { kind, k, root, room, sig, far, detail, lift, dim, dimShown, mats, lights, rank, ... }
function collectMats(root) {
  const set = new Set();
  root.traverse(o => { if (o.isMesh || o.isSprite) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m && set.add(m)); });
  const mats = [...set];
  mats.forEach(m => { if (m.color && !m.userData.bc) m.userData.bc = m.color.clone(); if (m.emissive && m.userData.bei === undefined) m.userData.bei = m.emissiveIntensity; });
  const lights = []; root.traverse(o => { if (o.isLight) { o.userData.bi ??= o.intensity; lights.push(o); } });
  return { mats, lights };
}
function applyDim(pl) {
  const f = 1 - pl.dim;
  pl.mats.forEach(m => { if (m.userData.bc) m.color.copy(m.userData.bc).multiplyScalar(f); if (m.emissive && m.userData.bei !== undefined && !m.userData.glowing) m.emissiveIntensity = m.userData.bei * f; });
  pl.lights.forEach(l => { l.intensity = l.userData.bi * f; });
  pl.dimShown = pl.dim;
}
function addPlace(k, kind, root, extra) {
  const { mats, lights } = collectMats(root);
  const pl = { kind, k, root, lift: 0, dim: 0, dimShown: 0, mats, lights, rank: Infinity, ...extra };
  places.set(k, pl);
  const e = empties.get(k); if (e) e.lines.visible = false;
  return pl;
}
// a layer came or went: pick up its materials, and redo the dim on the next frame
function refreshMats(pl) { const c = collectMats(pl.root); pl.mats = c.mats; pl.lights = c.lights; pl.dimShown = -1; }
function removePlace(k) {
  const pl = places.get(k); if (!pl || pl.kind === 'home') return;
  disposeGroup(pl.root); places.delete(k);
  const e = empties.get(k); if (e) e.lines.visible = true;
}
let fontsOk = false;

/* ---------- state ---------- */
let homeRm = null, homePl = null;   // Enhe's room: what createHomeRoom returns, and its place
let focusPlot = null;      // null = the whole grid
let activeHot = null;      // a thing in the home room
let activeObj = null;      // { k, i } a thing in someone's room
let hovered = null;
let motionOn = !reduced;

/* ---------- camera ---------- */
// On phones (and short landscape screens) the header, the card and the dock cover much of the screen, so the view is
// framed to the part they leave free: what you look at sits in the middle of it, far enough back to fit inside it.
// On bigger screens the whole screen counts as free and nothing moves.
const compactMQ = matchMedia('(max-width: 700px), (max-height: 520px)');
let free = { x: 0, y: 0, w: 1, h: 1 };   // css px from the canvas's top left
function measureFree() {
  const W = canvas.clientWidth, H = canvas.clientHeight;
  let top = 0, bottom = H, right = W;
  if (compactMQ.matches) {
    const c = canvas.getBoundingClientRect();
    const box = el => { const b = el?.getBoundingClientRect(); return b && b.width && b.height ? b : null; };
    document.querySelectorAll('.brand > .title, .brand > .tools').forEach(el => { const b = box(el); if (b) top = Math.max(top, b.bottom - c.top); });
    const d = box($('dock').firstElementChild); if (d) bottom = Math.min(bottom, d.top - c.top);   // the chips, not the fade above them
    // a card: a sheet along the bottom on phones, a column on the right on short wide screens
    [$('panel'), $('addPanel')].forEach(el => { const b = box(el); if (!b) return; if (b.width > W * 0.8) bottom = Math.min(bottom, b.top - c.top); else right = Math.min(right, b.left - c.left); });
    top += 8; bottom -= 8;
  }
  free = { x: 0, y: top, w: Math.max(1, right), h: Math.max(1, bottom - top) };
}
// the view slides to the middle of the free part (the rendered picture shifts, the camera itself doesn't).
// During a flight it slides on the flight's own clock, so opening a room is one motion, not a tilt and then a zoom.
const viewOff = { x: 0, y: 0 };
function applyViewOffset() { const W = Math.max(1, canvas.clientWidth), H = Math.max(1, canvas.clientHeight); camera.setViewOffset(W, H, viewOff.x, viewOff.y, W, H); }
const offTarget = () => [canvas.clientWidth / 2 - (free.x + free.w / 2), canvas.clientHeight / 2 - (free.y + free.h / 2)];
function setViewOff(x, y) { if (Math.abs(x - viewOff.x) + Math.abs(y - viewOff.y) < 0.05) return; viewOff.x = x; viewOff.y = y; applyViewOffset(); }
// outside a flight (a card opening or closing) it follows gently
function stepViewOffset(dt) { const [tx, ty] = offTarget(), s = reduced ? 1 : Math.min(1, dt * 6); setViewOff(viewOff.x + (tx - viewOff.x) * s, viewOff.y + (ty - viewOff.y) * s); }
let tween = null;
const flyEnd = new THREE.Vector3();
// fly to look at target from dist() away along dir. dist is asked again every frame, so the flight still lands right
// when a card opens just after it starts (that changes how much of a phone screen is free).
// the zoom-out limit is lifted while the camera flies, and set again (for the grid or the room) when it lands
function flyTo(target, dir, dist, ms = 1100, start = performance.now()) { tween = { p0: camera.position.clone(), t0: controls.target.clone(), o0: { ...viewOff }, t1: target, dir, dist, start, ms: reduced ? 1 : ms }; controls.enabled = false; controls.maxDistance = Infinity; }
// change which room is in focus: the room rises, the rest fades to black and the camera flies in, all together
function setFocus(k) { if (focusPlot === k) return false; focusPlot = k; setControlMode(k === null); startTrans(); updateOcclusion(); syncUrl(); return true; }
const aspect = () => free.w / free.h;
// a distance picked for a wide screen, stepped back so the same view fits the free part of a phone screen
// (further back when that part is narrower than `wide`, and when the UI leaves only a slice of the height, though
// never more than 2.5 times, so a tall form doesn't shrink the grid to nothing)
const fitDist = (d, wide = 1.3) => { const H = canvas.clientHeight; return compactMQ.matches ? d * Math.max(1, wide / aspect()) * H / Math.max(free.h, H * 0.4) : d; };
function roomDist() { const a = aspect(); return compactMQ.matches ? fitDist(24) : a < 0.7 ? 40 : a < 1 ? 33 : a < 1.4 ? 27 : 24; }
function overviewDist() { return (compactMQ.matches ? fitDist(128, 0.77) : aspect() < 0.8 ? 215 : 128) * Math.max(7, 2 * gridR + 1) / 9; }
// how far you can scroll out: well past the whole-grid view on the grid, a little past the starting view in a room
const GRID_ZOOM_OUT = 2.0;
const zoomOutLimit = () => focusPlot === null ? overviewDist() * GRID_ZOOM_OUT : roomDist() * 1.15 * 1.6;
// the fog starts just past the point you look at and moves with the camera, so zooming out never dims
// the rooms in view; it only fades the far edge of the grid
const FOG_NEAR = 1.1, FOG_FAR = 2.6;
function fitFog() { const cd = camera.position.distanceTo(controls.target); scene.fog.near = Math.max(90, cd * FOG_NEAR); scene.fog.far = Math.max(240, cd * FOG_FAR); }
function fitRange() { // how far the camera can pull back and see, for the current grid size
  if (!tween) controls.maxDistance = zoomOutLimit();
  camera.far = Math.max(500, overviewDist() * GRID_ZOOM_OUT * FOG_FAR + 60); camera.updateProjectionMatrix();
}
function goRoom(k) {
  const moved = setFocus(k); activeHot = null; activeObj = null;
  const pl = places.get(k); if (pl) pl.wantDetail = true;   // its full detail is built first (see jobs)
  // the camera aims at where the room ends up, so it glides in as the room rises
  const t = posOf(k).add(new THREE.Vector3(0, LIFT + 1.2, 0));
  flyTo(t, ROOM_DIR, () => roomDist() * 1.15, moved ? TRANS_MS : 1100, moved && trans ? trans.t0 : undefined);
  aimShadow(posOf(k).add(new THREE.Vector3(0, LIFT, 0)));
  renderChrome();
}
// your own square when you're signed in and have a room (the centre one for the home room's owner)
function myRoomKey() { return backend?.homeOwner ? HOME : myRoom ? keyOf(myRoom.px, myRoom.pz) : null; }
// go into a room and show its card
function enterRoom(k) {
  if (k === HOME) { goRoom(HOME); showHomeCard(); return; }
  const pl = placeNow(k); goRoom(k); if (pl) showRoomCard(pl.room);
}
// back to the grid, centred on your room if you have one, otherwise on the middle
function goOverview() {
  const moved = setFocus(null); activeHot = null; activeObj = null; hidePanel();
  const k = myRoomKey(), t = k ? posOf(k) : new THREE.Vector3(0, 0, 0), dir = new THREE.Vector3(1, 1.25, 1).normalize();
  flyTo(t, dir, overviewDist, moved ? TRANS_MS : 1400, moved && trans ? trans.t0 : undefined);
  renderChrome();
}
function focusHot(id) {
  const h = HOT_BY_ID[id]; if (!h) return;
  const moved = setFocus(HOME); if (moved) aimShadow(new THREE.Vector3(0, LIFT, 0));
  activeHot = id; activeObj = null;
  const t = new THREE.Vector3(h.t[0], h.t[1] + LIFT, h.t[2]), dir = new THREE.Vector3(...h.dir).normalize();
  flyTo(t, dir, () => fitDist(h.d), moved ? TRANS_MS : 1100, moved && trans ? trans.t0 : undefined);
  showHot(h); renderChrome();
}
function focusObj(k, i) {
  const pl = places.get(k); if (!pl) return;
  if (pl.kind === 'guest') detailNow(pl);
  if (!pl.objGroups?.[i]) return;
  const moved = setFocus(k); if (moved) aimShadow(posOf(k).add(new THREE.Vector3(0, LIFT, 0)));
  activeHot = null; activeObj = { k, i };
  const wp = new THREE.Vector3(); pl.objGroups[i].getWorldPosition(wp); wp.y = LIFT + 1.4;
  flyTo(wp, OBJ_DIR, () => fitDist(8.5), moved ? TRANS_MS : 1100, moved && trans ? trans.t0 : undefined);
  showObj(pl.room, i); renderChrome();
}

/* rooms that sit between the camera and the one in focus: they can't be clicked. They still fade to black
   with the rest and are hidden once dark (see the loop), so nothing vanishes mid-zoom. */
let blocked = new Set();
function updateOcclusion() {
  blocked = new Set();
  const f = focusPlot ? parseKey(focusPlot) : null;
  const test = k => { if (!f) return false; const [px, pz] = parseKey(k); const dx = px - f[0], dz = pz - f[1]; const b = dx >= 0 && dz >= 0 && dx + dz > 0 && dx <= 2 && dz <= 2; if (b) blocked.add(k); return b; };
  hitboxes.forEach(h => test(h.userData.plot));
  empties.forEach((e, k) => { e.lines.visible = !places.has(k) && !pending.has(k) && !blocked.has(k) && ring(k) <= gridR; });
}

/* ---------- links: cubby.vercel.app/<slug> opens that room, and the address follows the room you're in ---------- */
function slugOf(k) { return k === HOME ? HOME_SLUG : rooms.find(r => keyOf(r.px, r.pz) === k)?.slug || null; }
function keyOfSlug(s) { if (s === HOME_SLUG) return HOME; const r = rooms.find(r => r.slug === s); return r ? keyOf(r.px, r.pz) : null; }
const pathOf = k => { const s = k === null ? null : slugOf(k); return s ? '/' + s : '/'; };
// the room's name in the address, if it looks like one
function slugInPath() { let p = ''; try { p = decodeURIComponent(location.pathname); } catch {} p = p.replace(/^\/+|\/+$/g, '').toLowerCase(); return /^[a-z0-9-]+$/.test(p) ? p : null; }
// the room a shared link asks for, until it's found. The rooms have to load first, and until then the address stays as it is.
let linkWait = slugInPath();
function syncUrl() { if (!linkWait && pathOf(focusPlot) !== location.pathname) history.pushState(null, '', pathOf(focusPlot)); }
// go to the room a shared link asks for. loaded: the rooms are in, so a room that isn't found now isn't coming
function followLink(loaded) {
  if (!linkWait) return false;
  const k = keyOfSlug(linkWait);
  if (!k && !loaded) return false;
  if (!k) showNotice(`No room has the link /${linkWait}, so here’s the whole grid.`);
  linkWait = null; history.replaceState(null, '', pathOf(k));
  if (k) enterRoom(k);
  return !!k;
}
// the browser's back and forward buttons
window.addEventListener('popstate', () => {
  const s = slugInPath(), k = s && keyOfSlug(s);
  if (!addPanel.hidden) closeAdd();
  if (k) enterRoom(k); else { if (s) history.replaceState(null, '', '/'); goOverview(); }
});

/* ---------- panels ---------- */
const panel = $('panel'), addPanel = $('addPanel');
function hidePanel() { panel.hidden = true; }
function setKind(color, text) { panel.style.setProperty('--c', color); const kd = $('pKind'); kd.style.setProperty('--c', color); kd.lastElementChild.textContent = text; }
function setLinks(list) {
  const row = $('pLinks'); row.replaceChildren();
  list.filter(l => l && l.url).forEach(l => { const a = document.createElement('a'); a.className = 'next'; a.href = l.url; a.target = '_blank'; a.rel = 'noopener noreferrer nofollow'; a.textContent = l.label + ' \u2197'; row.appendChild(a); });
  row.hidden = !row.childElementCount;
}
function panelBasics(title, body, stack) { $('pTitle').textContent = title; $('pBody').textContent = body; $('pBody').classList.remove('open'); $('pStack').textContent = stack || ''; $('pTags').replaceChildren(); $('pSaved').hidden = true; $('shareRow').hidden = true; $('mineRow').hidden = true; $('reportRow').hidden = true; $('ownerRow').hidden = true; }
// the buttons at the bottom of the card: a room card leads back to the grid, a thing card leads back to its room
function setActions(kind) {
  panel.dataset.kind = kind;   // small screens drop a room card's buttons: the header and the card's hide button cover them
  $('backBtn').lastElementChild.textContent = kind === 'room' ? 'Back to the grid' : 'Back to the room';
  $('lookBtn').hidden = kind !== 'room';
  $('nextBtn').hidden = kind === 'room';
}
function showHot(h) {
  const k = KIND[h.kind];
  setKind(k.color, k.label);
  panelBasics(h.title, h.body, h.stack);
  setLinks(h.link ? [{ url: h.link, label: h.linkLabel }] : []);
  setActions('thing'); panel.hidden = false;
}
const TYPE_COLOR = { project: '#FF8A4C', interest: '#2CC4B3', about: '#F2C14E' };
function showRoomCard(room, isPreview, justSaved) {
  setKind(room.color, isPreview ? 'Preview, not saved yet' : 'Room');
  panelBasics(room.title, room.bio || 'No bio yet.', '');
  const k = keyOfRoom(room);   // looked up now: the list of rooms can refresh while the card is open
  room.objects.forEach((o, i) => addTag(o.name, TYPE_COLOR[o.type], () => focusObj(k, i)));
  setLinks(room.links || []);
  setActions('room');
  if (!isPreview) showShare(room.slug, room.title);
  const mine = !isPreview && backend && room.owner === backend.me;
  $('mineRow').hidden = !mine; $('pSaved').hidden = !(mine && justSaved);
  if (mine) setKind(room.color, room.hidden ? 'Your room, hidden after reports' : 'Your room');
  const canReport = !isPreview && !mine && room.owner && backend?.mode === 'live';
  $('reportRow').hidden = !canReport; $('reportStatus').textContent = '';
  const rb = $('reportBtn'); rb.hidden = false; rb.dataset.owner = room.owner || ''; rb.dataset.confirm = '';
  rb.textContent = backend?.me ? 'Report it' : 'Sign in to report';
  panel.hidden = false;
}
function addTag(text, color, onClick) { const b = document.createElement('button'); b.type = 'button'; b.className = 'tag'; b.style.setProperty('--c', color); b.textContent = text; b.addEventListener('click', onClick); $('pTags').appendChild(b); }
// the hand-built home room's card; its owner (signed in with Google) also sees who they're signed in as
function showHomeCard() {
  const mine = !!backend?.homeOwner;
  setKind('#E8402F', mine ? 'Your room' : 'Room');
  panelBasics(HOME_NAME, HOME_BIO, '');
  HOT.forEach(h => addTag(h.name, KIND[h.kind].color, () => focusHot(h.id)));
  setLinks([]); setActions('room'); showShare(HOME_SLUG, HOME_NAME);
  $('ownerRow').hidden = !mine;
  if (mine) $('ownerName').textContent = `Signed in as ${backend.user.name}.`;
  panel.hidden = false;
}
$('ownerOut').addEventListener('click', async () => { await backend.signOut(); hidePanel(); });
// a room card shows the room's link: phones open their share sheet, computers copy it
const canShare = touch && !!navigator.share;
$('shareBtn').textContent = canShare ? 'Share' : 'Copy link';
function showShare(slug, title) {
  $('shareRow').hidden = !slug; $('shareStatus').textContent = '';
  if (!slug) return;   // (a database without the slug column yet)
  $('shareUrl').textContent = `${location.host}/${slug}`;
  Object.assign($('shareBtn').dataset, { url: `${location.origin}/${slug}`, title });
}
$('shareBtn').addEventListener('click', async () => {
  const { url, title } = $('shareBtn').dataset, st = $('shareStatus');
  if (canShare) { try { await navigator.share({ title: `${title} · Cubby`, url }); return; } catch (e) { if (e?.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(url); st.textContent = 'Copied.'; } catch { st.textContent = 'Copy it from the address bar.'; }
});
function showObj(room, i) {
  const o = room.objects[i];
  setKind(TYPE_COLOR[o.type], o.type === 'project' ? 'Project' : o.type === 'about' ? 'About' : 'Interest');
  panelBasics(o.name, o.about || '', o.kit ? '' : `${o.parts ? o.parts.length : 0} parts`);
  setLinks(o.link ? [{ url: o.link, label: 'Open link' }] : []);
  setActions('thing'); panel.hidden = false;
}
function keyOfRoom(room) { for (const [k, pl] of places) if (pl.room === room) return k; return null; }
// leave a thing card: fly back out to the whole room (and show the room's card again)
function backToRoom() { hidePanel(); const k = focusPlot; activeHot = null; activeObj = null; if (!k) return; goRoom(k); const pl = places.get(k); if (pl?.room) showRoomCard(pl.room); else if (k === HOME) showHomeCard(); }
$('backBtn').addEventListener('click', () => { if (activeHot || activeObj) backToRoom(); else { hidePanel(); goOverview(); } });
$('lookBtn').addEventListener('click', () => hidePanel());
$('pClose').addEventListener('click', () => hidePanel());
// on small screens the bio shows two lines; a tap opens the rest
$('pBody').addEventListener('click', () => $('pBody').classList.toggle('open'));
$('nextBtn').addEventListener('click', () => {
  if (activeHot) { const i = HOT.findIndex(h => h.id === activeHot); focusHot(HOT[(i + 1) % HOT.length].id); return; }
  if (activeObj) { const pl = places.get(activeObj.k); if (pl) focusObj(activeObj.k, (activeObj.i + 1) % pl.room.objects.length); }
});

/* ---------- header + dock ---------- */
function renderChrome() {
  const pl = focusPlot ? places.get(focusPlot) : null;
  $('placeName').textContent = focusPlot === null ? 'The grid' : focusPlot === HOME ? HOME_NAME : (pl?.room?.title || 'Empty square');
  document.title = focusPlot === null ? 'Cubby' : `${$('placeName').textContent} · Cubby`;
  $('hint').textContent = focusPlot === null
    ? `Every square holds someone’s room. ${touch ? 'Tap one to go in. Drag to move around, turn with two fingers.' : 'Click one to go in. Drag to move around, right-drag to turn.'}`
    : touch ? 'Drag to turn the room. Pinch to zoom. Tap anything to read about it.' : 'Drag to turn the room. Scroll to zoom in on what’s under the mouse. Click anything to read about it.';
  $('viewBtn').hidden = focusPlot === null;   // only shown inside a room, to go back to the grid
  const n = rooms.length + 1;
  $('stats').textContent = `${n} room${n === 1 ? '' : 's'}`;
  const dock = $('dock'); dock.replaceChildren();
  const label = t => { const l = document.createElement('span'); l.className = 'group-label'; l.textContent = t; dock.appendChild(l); };
  const chip = (text, color, on, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip' + (on ? ' on' : ''); b.style.setProperty('--c', color); const d = document.createElement('span'); d.className = 'dot'; b.append(d, document.createTextNode(text)); b.addEventListener('click', fn); dock.appendChild(b); };
  if (focusPlot === HOME) {
    [['Interests', ['race', 'shuttle']], ['Projects', ['build']], ['About', ['about']]].forEach(([t, kinds]) => { label(t); HOT.filter(h => kinds.includes(h.kind)).forEach(h => chip(h.name, KIND[h.kind].color, activeHot === h.id, () => focusHot(h.id))); });
  } else if (pl?.room) {
    label(pl.room.title);
    pl.room.objects.forEach((o, i) => chip(o.name, TYPE_COLOR[o.type], activeObj && activeObj.k === focusPlot && activeObj.i === i, () => focusObj(focusPlot, i)));
  } else {
    label('Rooms');
    chip(HOME_NAME, '#E8402F', false, () => enterRoom(HOME));
    rooms.forEach(r => chip(r.title, r.color, false, () => enterRoom(keyOf(r.px, r.pz))));
    if (!rooms.length) label('No other rooms yet');
  }
}
$('viewBtn').addEventListener('click', () => goOverview());
const motionBtn = $('motionBtn');
// on small screens only the icon shows, so the label also goes on the button itself
const motionLabel = () => { const t = motionOn ? 'Pause motion' : 'Play motion'; motionBtn.querySelector('.lbl').textContent = t; motionBtn.setAttribute('aria-label', t); motionBtn.classList.toggle('paused', !motionOn); };
motionLabel();
motionBtn.addEventListener('click', () => { motionOn = !motionOn; motionLabel(); });

/* ---------- saved rooms in the world ---------- */
// everything a room is built from: when any of it changes (a new room code), the room is rebuilt
const sigOf = r => JSON.stringify([r.title, r.bio, r.color, r.links, r.objects, r.decor]);
function applyRooms(list) {
  const seen = new Set(); const clean = [];
  list.slice().sort((x, y) => String(x.createdAt || '').localeCompare(String(y.createdAt || ''))).forEach(r => {
    if (!Number.isInteger(r.px) || !Number.isInteger(r.pz) || Math.abs(r.px) > MAX_R || Math.abs(r.pz) > MAX_R) return;
    const k = keyOf(r.px, r.pz); if (k === HOME || seen.has(k)) return;
    seen.add(k); clean.push(r);
  });
  rooms = clean;
  myRoom = backend ? rooms.find(r => r.owner === backend.me) || null : null;
  const farthest = rooms.reduce((m, r) => Math.max(m, Math.abs(r.px), Math.abs(r.pz)), 0);
  const wantR = Math.max(MIN_R, Math.min(MAX_R, farthest + 1)); if (wantR !== gridR) setGridR(wantR);
  const wanted = new Map(rooms.map(r => [keyOf(r.px, r.pz), r]));
  // gone rooms leave now. New and changed ones wait for their far version (a changed room keeps showing
  // its old version until then, so it never blinks out)
  [...places.entries()].forEach(([k, pl]) => { if (pl.kind === 'guest' && !wanted.has(k)) removePlace(k); });
  pending.forEach((r, k) => { if (!wanted.has(k)) { pending.delete(k); dropStaged(k); } });
  wanted.forEach((r, k) => {
    const pl = places.get(k);
    if (pl?.kind === 'guest' && pl.sig === sigOf(r) && pl.room.owner === r.owner) { pl.room = r; pending.delete(k); }
    else pending.set(k, r);
  });
  updateOcclusion(); renderChrome(); showBgLoad();
  $('addBtn').textContent = myRoom || backend?.homeOwner ? 'Your room' : 'Add your room';
}

/* ---------- jobs: building rooms without stutter ----------
   Each room first gets its far version: from the browser cache (about 1 ms) or by building and baking it
   (about 15 ms). Then the rooms nearest the camera get full detail in small steps: build it (about 7 ms),
   compile its shaders in the background, send its pictures to the graphics card a few at a time, and only
   then swap it in. Heavy steps run while the camera is still; while it moves, only light ones do. */
const pending = new Map();      // square -> room code whose far version isn't made yet
let cached = new Map();         // cache key -> baked data, read from the browser cache at start
let revealed = false;           // the loading screen is gone
let ranked = [];                // guest rooms, nearest the camera first (updated a few times a second)
// how many of the rooms nearest the camera show full detail (a full room is ~200 draw calls, a far one ~7; Enhe's
// room ~310 against 2). Slow devices lower it, down to none (see "keep it smooth"); the room you're in always gets detail.
let nearRooms = 6;
const ahead = () => Math.min(4, nearRooms);   // rooms past those that get their detail built ahead of time, so moving around doesn't wait
const keepDetail = () => nearRooms + ahead() + 4;   // past this rank, a room's detail is freed again
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));

function buildDetail(pl) {
  const group = new THREE.Group(); group.visible = false; pl.root.add(group);
  const built = buildRecipeRoom(group, pl.room, fontsOk);
  pl.detail = { group, room: built.group, anims: built.anims, objGroups: built.objGroups, state: 'built' };
  refreshMats(pl);
}
// show the full room once it's ready and wanted, otherwise the far version (neither while the place is hidden, see the loop)
function showLayer(pl) {
  const d = !!(pl.wantDetail && pl.detail?.state === 'ready');
  pl.showingDetail = d; pl.far.visible = !d && !pl.hidden; if (pl.detail) pl.detail.group.visible = d && !pl.hidden;
  pl.objGroups = d ? pl.detail.objGroups : null; pl.anims = d ? pl.detail.anims : null;
}
function dropDetail(pl) { const g = pl.detail.group; pl.detail = null; showLayer(pl); disposeGroup(g); refreshMats(pl); }

// a new room that isn't cached is built and baked over a few frames: build (about 8 ms), read its pictures'
// colours (about 5 ms), then bake it and put it on the grid (about 3 ms). staged holds it in between.
const staged = new Map();   // square -> { sig, pl: { root, room, detail }, sampled, data }
function dropStaged(k) { const s = staged.get(k); if (s) { disposeGroup(s.pl.root); staged.delete(k); } }
// give the room at k its far version (and swap it in for an older version of the same room)
function makeFar(k) {
  const r = pending.get(k); pending.delete(k);
  const sig = sigOf(r), key = roomCache.cacheKey(r.owner, sig);
  let s = staged.get(k); staged.delete(k);
  if (s && s.sig !== sig) { disposeGroup(s.pl.root); s = null; }
  const pl = s?.pl || { root: new THREE.Group(), room: r }, root = pl.root;
  root.position.copy(posOf(k));
  let data = cached.get(key); cached.delete(key);
  if (!data) {   // not cached: build it once, bake it, keep the detail
    if (!pl.detail) buildDetail(pl);
    data = bakeRoom(pl.detail.room); roomCache.write(key, data);
  }
  const far = farLayer(data, r, fontsOk); root.add(far);
  const old = places.get(k);
  if (old) removePlace(k);
  scene.add(root);
  const np = addPlace(k, 'guest', root, { room: r, sig, far, detail: pl.detail || null, showingDetail: false, wantDetail: k === focusPlot });
  if (old) { np.lift = old.lift; np.dim = old.dim; np.rank = old.rank; }
  else np.dim = revealed || (focusPlot && k !== focusPlot) ? 1 : 0;   // after the reveal, new rooms fade in
  applyDim(np); showLayer(np);
  return np;
}
// a room is needed right now (you clicked it): make its far version if it's still waiting
function placeNow(k) { if (pending.has(k)) { makeFar(k); updateOcclusion(); showBgLoad(); } return places.get(k); }
// you opened one of the room's things: its detail can't wait for the background
function detailNow(pl) {
  pl.wantDetail = true;
  if (!pl.detail) buildDetail(pl);
  pl.detail.state = 'ready'; showLayer(pl);
}
function nearestPending() {
  const c = controls.target; let best = null, bd = Infinity;
  pending.forEach((r, k) => { const d = posOf(k).distanceToSquared(c); if (d < bd) { bd = d; best = k; } });
  return best;
}
// the next step for a room's far version: straight from the cache, or build / colours / bake in turn
function farJob(k) {
  const r = pending.get(k), sig = sigOf(r), place = () => { makeFar(k); updateOcclusion(); showBgLoad(); };
  if (cached.has(roomCache.cacheKey(r.owner, sig))) return { kind: 'far-cached', heavy: false, run: place };
  const s = staged.get(k);
  if (!s || s.sig !== sig) return { kind: 'far-build', heavy: true, run: () => {
    dropStaged(k); const pl = { root: new THREE.Group(), room: r }; buildDetail(pl); staged.set(k, { sig, pl });
  } };
  if (!s.sampled) return { kind: 'far-colours', heavy: true, run: () => { sampleColors(s.pl.detail.room); s.sampled = true; } };
  return { kind: 'far-bake', heavy: false, run: place };
}
// the next step for a room's detail, or null while its shaders are still compiling. heavy = takes a few ms
function detailJob(pl) {
  const d = pl.detail;
  if (!d) return { kind: 'detail-build', heavy: true, run: () => buildDetail(pl) };
  if (d.state === 'built') return { kind: 'detail-compile', heavy: true, run: () => {   // ~9 ms: three sets up each material up front
    d.state = 'warming'; d.tex = [];
    d.group.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map && !m.map.userData.shared) d.tex.push(m.map); }); });
    renderer.compileAsync(d.group, camera, scene).then(() => { d.compiled = true; }, () => { d.compiled = true; });
  } };
  if (d.state === 'warming' && d.tex.length) return { kind: 'detail-pictures', heavy: false, run: () => { for (let n = 0; n < 3 && d.tex.length; n++) renderer.initTexture(d.tex.pop()); } };
  if (d.state === 'warming' && d.compiled) return { kind: 'detail-show', heavy: false, run: () => { d.state = 'ready'; showLayer(pl); } };
  return null;
}
function nextJob(calm) {
  // heavy steps wait for the camera to be still, except for the room you're flying into (one step every 8th frame)
  const ok = (j, focused) => j && (calm || !j.heavy || (focused && jobFrame % 8 === 0)) ? j : null;
  // 1. the room you're in
  const f = focusPlot ? places.get(focusPlot) : null;
  if (f?.kind === 'guest' && f.detail?.state !== 'ready') { const j = ok(detailJob(f), true); if (j) return j; }
  // 2. far versions for rooms that don't have one yet, nearest first
  if (pending.size) { const j = ok(farJob(nearestPending())); if (j) return j; }
  // 3. detail for the nearest rooms, then a few ahead
  for (const pl of ranked) {
    if (pl.rank >= nearRooms + ahead()) break;
    if (pl.farOut || pl.detail?.state === 'ready' || places.get(pl.k) !== pl) continue;   // (a replaced room is skipped)
    const j = ok(detailJob(pl)); if (j) return j;
  }
  // 4. free the detail of rooms far down the list
  for (const pl of ranked) if (pl.detail && pl.rank >= keepDetail() && !pl.wantDetail && places.get(pl.k) === pl) return { kind: 'detail-free', heavy: false, run: () => dropDetail(pl) };
  return null;
}
let lastMove = 0, jobFrame = 0;
controls.addEventListener('change', () => { lastMove = performance.now(); });
function runJobs(now) {
  if (!revealed) return;   // before the reveal, preload() does this in bigger chunks
  const calm = !tween && !trans && now - lastMove > 250;
  const t0 = performance.now(); jobFrame++;
  // still: steps for up to 6 ms. moving: one light step a frame
  for (;;) {
    const j = nextJob(calm); if (!j) break;
    j.run();
    if (!calm || performance.now() - t0 > 6) break;
  }
}
// the small "Loading rooms" line under the hint, while far versions are still coming in after the reveal
function showBgLoad() { const el = $('bgLoad'); if (!el) return; el.hidden = !revealed || !pending.size; if (!el.hidden) el.textContent = `Loading ${pending.size} more room${pending.size === 1 ? '' : 's'}…`; }

/* ---------- add your room ---------- */
$('promptText').value = DEEP_PROMPT;
function freeSquares() {
  const taken = new Set(rooms.filter(r => !backend || r.owner !== backend.me).map(r => keyOf(r.px, r.pz))); taken.add(HOME);
  const others = rooms.filter(r => !backend || r.owner !== backend.me);
  const R = Math.min(gridR, Math.max(MIN_R, others.reduce((m, r) => Math.max(m, Math.abs(r.px), Math.abs(r.pz)), 0) + 1));
  const all = []; for (let px = -R; px <= R; px++) for (let pz = -R; pz <= R; pz++) { const k = keyOf(px, pz); if (!taken.has(k)) all.push(k); }
  return all.sort((a, b) => { const [ax, az] = parseKey(a), [bx, bz] = parseKey(b); return ring(a) - ring(b) || (Math.abs(ax) + Math.abs(az)) - (Math.abs(bx) + Math.abs(bz)) || ax - bx || az - bz; });
}
const isFree = k => freeSquares().includes(k);
function targetSquare() {
  const free = freeSquares();
  const want = addPanel.dataset.target || (myRoom ? keyOf(myRoom.px, myRoom.pz) : null);
  return want && free.includes(want) ? want : free[0];
}
let addTarget = null;
function renderAddState() {
  const k = targetSquare(); addTarget = k || null;
  if (!k) { $('squareLine').textContent = 'Every square is taken right now.'; return; }
  const [px, pz] = parseKey(k);
  $('squareLine').textContent = `It goes on square ${px}, ${pz}. To pick a different one, click any glowing empty square first.` + (myRoom ? ' This replaces your current room.' : '');
  const signedIn = !!backend?.me;
  $('saveBtn').textContent = !signedIn ? 'Sign in with Google to add' : myRoom ? 'Update my room' : 'Add my room';
  renderAuthLine();
}
// who you are, and a way out. Looking around never needs an account.
function renderAuthLine() {
  const line = $('authLine'); line.replaceChildren();
  if (!backend || backend.mode === 'demo') { line.textContent = 'Demo mode: no sign-in needed.'; return; }
  if (!backend.user) {
    const inBtn = document.createElement('button'); inBtn.type = 'button'; inBtn.className = 'text-btn'; inBtn.textContent = 'Sign in';
    inBtn.addEventListener('click', async () => { try { await backend.signIn(); } catch (e) { $('saveStatus').textContent = e?.message || 'Could not start sign-in.'; } });
    line.append(document.createTextNode('Adding a room needs a quick Google sign-in (one room per account). Looking around never does. '), inBtn);
    return;
  }
  const out = document.createElement('button'); out.type = 'button'; out.className = 'text-btn'; out.textContent = 'Sign out';
  out.addEventListener('click', async () => { await backend.signOut(); });
  line.append(document.createTextNode(`Signed in as ${backend.user.name}. `), out);
}
function openAdd(targetK) {
  if (focusPlot !== null) goOverview();
  hidePanel(); addPanel.hidden = false;
  $('addTitle').textContent = myRoom ? 'Update your room' : 'Add your room';
  if (targetK && isFree(targetK)) addPanel.dataset.target = targetK;
  renderAddState();
}
function closeAdd() {
  addPanel.hidden = true; addTarget = null;
  delete addPanel.dataset.target;
  $('saveStatus').textContent = ''; $('codeError').hidden = true;
  renderChrome();
}
async function copyText(text, statusEl, okMsg) {
  try { await navigator.clipboard.writeText(text); statusEl.textContent = okMsg; }
  catch {
    statusEl.textContent = 'Could not copy automatically. The text is selected: press Ctrl+C (or Cmd+C).';
    const ta = text === DEEP_PROMPT ? $('promptText') : $('codeInput');
    if (text === DEEP_PROMPT) $('promptBox').open = true;
    ta.focus(); ta.select();
  }
}
$('addBtn').addEventListener('click', () => { if (backend?.homeOwner) { closeAdd(); goRoom(HOME); showHomeCard(); } else if (myRoom && addPanel.hidden) { const k = keyOf(myRoom.px, myRoom.pz); placeNow(k); goRoom(k); showRoomCard(places.get(k)?.room || myRoom); } else openAdd(); });
$('addClose').addEventListener('click', closeAdd);
$('copyPrompt').addEventListener('click', () => copyText(DEEP_PROMPT, $('copyStatus'), 'Copied. Paste it into your own Claude.'));
// one click: check the code, pick the square, save, then fly to the new room
$('saveBtn').addEventListener('click', async () => {
  if (!backend) return;
  const btn = $('saveBtn'), st = $('saveStatus');
  $('codeError').hidden = true; st.textContent = '';
  let room;
  try { room = parseRoomCode($('codeInput').value); } catch (e) { $('codeError').textContent = e.message; $('codeError').hidden = false; return; }
  const k = targetSquare();
  if (!k) { $('codeError').textContent = 'Every square is taken right now.'; $('codeError').hidden = false; return; }
  if (!backend.me) {
    try { sessionStorage.setItem('rg-code', $('codeInput').value); sessionStorage.setItem('rg-resume', addPanel.dataset.target || '1'); } catch {}
    btn.disabled = true; st.textContent = 'Opening Google...';
    let res = false;
    try { res = await backend.signIn(); } catch (e) { st.textContent = e?.message || 'Could not start sign-in.'; btn.disabled = false; return; }
    if (res === 'redirect') return;   // off to Google; the add finishes when the page comes back
    try { sessionStorage.removeItem('rg-resume'); } catch {}
    btn.disabled = false; st.textContent = '';
    if (!res || !backend.me) return;   // the sign-in card was closed
    // signed in right here (Google's button): pick up your rooms, then finish adding
    try { applyRooms(await backend.listRooms()); } catch {}
    renderAddState(); btn.click();
    return;
  }
  const [px, pz] = parseKey(k);
  btn.disabled = true; st.textContent = 'Saving...';
  try {
    await backend.saveRoom(room, px, pz);
    try { sessionStorage.removeItem('rg-code'); } catch {}
    applyRooms(await backend.listRooms());
    // build your room in one go (far version and full detail), after the message has had a frame to show
    st.textContent = 'Building your room…'; await nextFrame();
    const pl = placeNow(k); if (pl) detailNow(pl);
    addPanel.hidden = true; delete addPanel.dataset.target; st.textContent = '';
    goRoom(k); if (pl) showRoomCard(pl.room, false, true);
  } catch (e) { st.textContent = e?.message || 'Could not save. Try again.'; }
  finally { btn.disabled = false; }
});
$('codeInput').addEventListener('input', () => { try { sessionStorage.setItem('rg-code', $('codeInput').value); } catch {} });
$('editBtn').addEventListener('click', () => {
  if (!myRoom) return;
  const { owner, px, pz, id, createdAt, slug, ...code } = myRoom;
  $('codeInput').value = JSON.stringify(code, null, 2);
  openAdd();
});
$('removeBtn').addEventListener('click', async () => {
  const btn = $('removeBtn');
  if (btn.dataset.confirm !== '1') { btn.dataset.confirm = '1'; btn.textContent = 'Tap again to delete'; setTimeout(() => { btn.dataset.confirm = ''; btn.textContent = 'Delete it'; }, 4000); return; }
  btn.dataset.confirm = ''; btn.textContent = 'Delete it'; btn.disabled = true;
  try { await backend.deleteRoom(); hidePanel(); applyRooms(await backend.listRooms()); goOverview(); }
  catch (e) { $('pStack').textContent = e?.message || 'Could not delete. Try again.'; }
  finally { btn.disabled = false; }
});

$('reportBtn').addEventListener('click', async () => {
  const btn = $('reportBtn'), st = $('reportStatus');
  if (!backend?.me) { try { await backend.signIn(); } catch (e) { st.textContent = e?.message || ''; } return; }
  if (btn.dataset.confirm !== '1') { btn.dataset.confirm = '1'; btn.textContent = 'Tap again to report'; return; }
  btn.disabled = true;
  try { await backend.report(btn.dataset.owner, 'reported from the room card'); btn.hidden = true; st.textContent = 'Thanks. Rooms with 3 reports get hidden.'; }
  catch (e) { st.textContent = e?.message || 'Could not send the report.'; }
  finally { btn.disabled = false; btn.dataset.confirm = ''; }
});

/* ---------- picking ---------- */
const ray = new THREE.Raycaster(); const pointer = new THREE.Vector2();
let pointerIn = false, pointerDirty = false, downAt = null;
const tip = $('tip');
function upFind(o, keyName) { while (o) { if (o.userData && o.userData[keyName] !== undefined) return o.userData[keyName]; o = o.parent; } return undefined; }
const isOpaque = o => o.isMesh && !(Array.isArray(o.material) ? false : o.material.transparent);
function pick() {
  ray.setFromCamera(pointer, camera);
  if (homeRm && focusPlot === HOME) {
    for (const h of ray.intersectObjects(homeRoot.children, true)) { const id = upFind(h.object, 'hot'); if (id) return { type: 'hot', id }; if (isOpaque(h.object)) break; }
  }
  const pl = focusPlot && focusPlot !== HOME ? places.get(focusPlot) : null;
  if (pl?.objGroups) {
    for (const h of ray.intersectObjects(pl.root.children, true)) { const i = upFind(h.object, 'obj'); if (i !== undefined) return { type: 'obj', k: focusPlot, i }; if (isOpaque(h.object)) break; }
  }
  const hb = ray.intersectObjects(hitboxes, false).find(h => focusPlot ? h.object.userData.plot === focusPlot : !blocked.has(h.object.userData.plot));
  return hb ? { type: 'plot', id: hb.object.userData.plot } : null;
}
function describe(h) {
  if (!h) return null;
  if (h.type === 'hot') { const x = HOT_BY_ID[h.id]; return { text: x.name, color: KIND[x.kind].color }; }
  if (h.type === 'obj') { const o = places.get(h.k).room.objects[h.i]; return { text: o.name, color: TYPE_COLOR[o.type] }; }
  if (h.id === HOME) return { text: HOME_NAME, color: '#E8402F' };
  const pl = places.get(h.id), q = pending.get(h.id);
  if (pl || q) { const r = pl ? pl.room : q; return { text: r.title, color: r.color }; }
  return { text: addPanel.hidden ? 'Empty square: add your room here' : 'Put my room here', color: GRID };
}
function glowGroups(h) {
  if (!h) return [];
  if (h.type === 'hot') return homeRm?.groups[h.id] || [];
  if (h.type === 'obj') return [places.get(h.k)?.objGroups?.[h.i]].filter(Boolean);
  return [];
}
function setGlow(h, on) {
  glowGroups(h).forEach(g => g.traverse(o => {
    if (!o.isMesh) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
      if (!m.emissive) return;
      if (m.userData.gE === undefined) { m.userData.gE = m.emissive.getHex(); m.userData.gI = m.emissiveIntensity; }
      if (on) { m.userData.glowing = true; m.emissive.set('#FF9A5C'); m.emissiveIntensity = 0.22; } else { m.userData.glowing = false; m.emissive.setHex(m.userData.gE); m.emissiveIntensity = m.userData.gI; }
    });
  }));
}
function sameHit(a, b) { return (!a && !b) || (a && b && a.type === b.type && a.id === b.id && a.k === b.k && a.i === b.i); }
function setHover(h) {
  if (sameHit(hovered, h)) return;
  setGlow(hovered, false);
  if (hovered?.type === 'plot') { const e = empties.get(hovered.id); if (e) e.hot = false; }
  hovered = h;
  setGlow(h, true);
  if (h?.type === 'plot') { const e = empties.get(h.id); if (e) e.hot = true; }
  const d = describe(h);
  if (d) { tip.replaceChildren(); const dot = document.createElement('span'); dot.className = 'dot'; dot.style.setProperty('--c', d.color); tip.append(dot, document.createTextNode(d.text)); tip.hidden = false; canvas.style.cursor = 'pointer'; }
  else { tip.hidden = true; canvas.style.cursor = 'grab'; }
}
function setPointer(e) { const r = canvas.getBoundingClientRect(); pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); tip.style.left = (e.clientX - r.left) + 'px'; tip.style.top = (e.clientY - r.top) + 'px'; }
canvas.addEventListener('pointermove', e => { setPointer(e); pointerIn = e.pointerType === 'mouse'; pointerDirty = true; });
canvas.addEventListener('pointerleave', () => { pointerIn = false; setHover(null); });
canvas.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
// in a room, scrolling in slides toward whatever is under the mouse and scrolling out drifts back to the room's middle.
// Each step moves the aim by the same share the zoom takes off the distance, so the spot under the mouse stays put.
const zoomShift = new THREE.Vector3();
canvas.addEventListener('wheel', e => {
  if (focusPlot === null || tween || !e.deltaY) return;
  const f = 1 - Math.pow(0.95, controls.zoomSpeed * Math.abs(e.deltaY) / (100 * Math.max(1, window.devicePixelRatio | 0)));
  let aim;
  if (e.deltaY < 0) {
    if (controls.getDistance() <= controls.minDistance + 0.01) return;
    setPointer(e); ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObjects(places.get(focusPlot)?.root.children || [], true)[0];
    if (!hit) return;
    aim = hit.point;
  } else aim = posOf(focusPlot).setY(LIFT + 1.2);
  zoomShift.subVectors(aim, controls.target).multiplyScalar(f);
  controls.target.add(zoomShift); camera.position.add(zoomShift);
}, { passive: true });
canvas.addEventListener('pointerup', e => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6 || tween) { downAt = null; return; }
  downAt = null; setPointer(e);
  const h = pick(); if (!h) return;
  if (h.type === 'hot') { focusHot(h.id); return; }
  if (h.type === 'obj') { focusObj(h.k, h.i); return; }
  const k = h.id, pl = placeNow(k);
  if (k === HOME) { if (focusPlot !== HOME) { goRoom(HOME); showHomeCard(); } return; }
  if (pl) { if (focusPlot !== k) goRoom(k); showRoomCard(pl.room); return; }
  if (!focusPlot) openAdd(k);
});
window.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (!addPanel.hidden) closeAdd(); else if (activeHot || activeObj) backToRoom(); else if (focusPlot !== null) goOverview(); else hidePanel(); });

function resize() { renderer.setSize(canvas.clientWidth, canvas.clientHeight, false); measureFree(); applyViewOffset(); fitRange(); }
new ResizeObserver(resize).observe(canvas); resize();
// the header, the cards and the dock change size as they fill, show and hide: measure the free part again
const uiWatch = new ResizeObserver(() => measureFree());
[...document.querySelectorAll('.brand > .title, .brand > .tools'), $('dock'), panel, addPanel].forEach(el => uiWatch.observe(el));
function showNotice(msg) { const n = $('notice'); n.textContent = msg; n.hidden = false; }

/* ---------- keep it smooth: draw less when frames get slow ----------
   The frame rate decides, not guesses about the device. Each step down draws fewer pixels or shows fewer rooms in
   full detail (the rest show their baked version), until the whole grid is baked. If a step is still too slow, it moves
   down again and never climbs back to a step that lagged. The step is remembered for the next visit. */
// [sharpness, how many of the nearest rooms show full detail]
const LADDER = [[2, 6], [1.5, 6], [1.5, 3], [1.25, 3], [1.25, 1], [1, 1], [1, 0], [0.85, 0], [0.7, 0]];
const STEPS = LADDER.map(([px, near]) => [Math.min(px, DEVICE_PX), near]).filter((s, i, a) => !i || s[0] !== a[i - 1][0] || s[1] !== a[i - 1][1]);
const tooSlow = new Set();
// a first visit on a phone starts a few steps down, so its first seconds aren't choppy; a fast phone climbs back up
let step = 0; try { const saved = localStorage.getItem('cubby-quality'); step = saved !== null ? Math.min(STEPS.length - 1, Math.max(0, Number(saved) || 0)) : touch ? STEPS.findIndex(([px, near]) => px <= 1.5 && near <= 3) : 0; } catch {}
function applyStep() {
  const [px, near] = STEPS[step];
  renderer.setPixelRatio(px); nearRooms = near;
  const size = px >= 1.25 ? 2048 : 1024, shadowsOn = px >= Math.min(1, DEVICE_PX);
  if (key.castShadow !== shadowsOn) key.castShadow = shadowsOn;
  if (key.shadow.mapSize.x !== size) { key.shadow.mapSize.set(size, size); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
  resize(); renderer.shadowMap.needsUpdate = true;
  try { localStorage.setItem('cubby-quality', String(step)); } catch {}
}
let spWin = 0, spFrames = 0, spLast = 0, spGood = 0, spStart = Infinity;   // starts after the reveal, so loading never counts
function trackSpeed(now) {
  const gap = now - spLast; spLast = now;
  if (now < spStart || document.hidden || gap > 400) return;   // skip start-up and tab switches
  spWin += gap; spFrames++;
  const avg = spWin / spFrames;
  // judged every 2 s, or after 1 s when it's very slow (under 25 fps), which also steps down two at once
  if (spWin < 2000 && !(spWin >= 1000 && avg > 40)) return;
  spWin = 0; spFrames = 0;
  if (avg > 25 && step < STEPS.length - 1) { tooSlow.add(step); step = Math.min(STEPS.length - 1, step + (avg > 40 ? 2 : 1)); spGood = 0; applyStep(); spStart = now + 1500; }  // under ~40 fps
  else if (avg < 18.5) { if (++spGood >= 4 && step > 0 && !tooSlow.has(step - 1)) { step--; spGood = 0; applyStep(); spStart = now + 1500; } }
  else spGood = 0;
}
applyStep();

/* ---------- loop ---------- */
const clock = new THREE.Clock();
let elapsed = 0, tvAcc = 0, lastLod = 0, frame = 0;
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05); frame++;
  // raise the room in focus and fade the rest to black. While a focus change is running, all of it
  // follows one shared eased clock (the same one the camera uses), so it moves as one motion.
  const kSel = focusPlot;
  const te = trans ? ease(Math.min(1, (performance.now() - trans.t0) / TRANS_MS)) : 1;
  places.forEach((pl, k) => {
    const hoverUp = !kSel && hovered?.type === 'plot' && hovered.id === k ? 0.5 : 0;
    const liftT = k === kSel ? LIFT : hoverUp;
    const dimT = kSel && k !== kSel ? 1 : 0;
    const f0 = trans?.from.get(k);
    if (f0) { pl.lift = f0.lift + (liftT - f0.lift) * te; pl.dim = f0.dim + (dimT - f0.dim) * te; }
    else {
      const sl = reduced ? 1 : Math.min(1, dt * 5), sd = reduced ? 1 : Math.min(1, dt * 3);
      pl.lift += (liftT - pl.lift) * sl; pl.dim += (dimT - pl.dim) * sd;
    }
    const bob = k === kSel && !reduced ? Math.sin(elapsed * 0.9) * 0.12 * (pl.lift / LIFT) : 0;
    pl.root.position.y = pl.lift + bob;
    const hb = hitByKey.get(k); if (hb) hb.position.y = 3.4 + pl.lift;
    if (Math.abs(pl.dim - dimT) < 0.005) pl.dim = dimT;
    if (Math.abs(pl.dim - pl.dimShown) > 0.01 || (pl.dim === dimT && pl.dimShown !== dimT)) applyDim(pl);
    // other rooms go once they've faded all the way to black. Enhe's room hides its versions but keeps its lamps in
    // the scene: taking lights out makes every material rebuild its shader, a stall just as you land in a room
    const gone = pl.dim >= 0.995 || pl.farOut;
    if (pl.kind !== 'home') pl.root.visible = !gone;
    else if (pl.hidden !== gone) { pl.hidden = gone; showLayer(pl); }
  });
  const gT = kSel ? 1 : 0, uD = groundMat.uniforms.uDim;
  if (trans) uD.value = trans.g + (gT - trans.g) * te; else uD.value += (gT - uD.value) * Math.min(1, dt * 3);
  const u = uD.value, keep = 1 - u;
  scene.background.copy(BG).lerp(BLACK, u); scene.fog.color.copy(scene.background); groundMat.uniforms.uBg.value.copy(scene.background); fitFog();
  rain.material.opacity = 0.5 * keep; rain.visible = keep > 0.005;
  empties.forEach((e, k) => { const lit = e.hot || (k === addTarget && !addPanel.hidden); e.lines.material.opacity = lit ? 0.75 * keep : 0; });
  if (trans && te >= 1) trans = null;
  if (motionOn) {
    elapsed += dt;
    groundMat.uniforms.uTime.value = elapsed;
    stepRain(dt);
    if (homePl.showingDetail && camera.position.distanceTo(posOf(HOME)) < 75) { homeRm.animators.forEach(f => f(dt, elapsed)); tvAcc += dt; if (tvAcc > 1 / 24) { tvAcc = 0; homeRm.drawTV(elapsed); } }
    places.forEach(pl => { if (pl.anims && pl.showingDetail && pl.root.visible) pl.anims.forEach(f => f(dt, elapsed)); });
  }
  const nowMs = performance.now();
  // level of detail: the few rooms nearest the camera (and the one you're in) show full detail once it's ready;
  // the rest show their far version. Rooms lost in the fog are not drawn at all. During a flight a room only ever
  // gains detail, so the room you're leaving doesn't turn baked while it still fills the screen.
  if (nowMs - lastLod > 300) {
    lastLod = nowMs; const fogOut = scene.fog.far + 20;
    const all = [];
    places.forEach((pl, k) => {
      pl.camD = camera.position.distanceTo(pl.root.position);
      pl.farOut = k !== focusPlot && pl.camD > fogOut;
      all.push(pl);
    });
    all.sort((a, b) => a.camD - b.camD);
    all.forEach((pl, i) => { pl.rank = i; pl.wantDetail = pl.k === focusPlot || (i < nearRooms && !pl.farOut) || !!(tween && pl.showingDetail); showLayer(pl); });
    ranked = all.filter(pl => pl.kind === 'guest');   // (Enhe's room is always built, so the jobs skip it)
  }
  if (tween) {
    if (!tween.measured) { tween.measured = true; measureFree(); }   // a card opened with this flight is in place now
    const k = Math.min(1, (performance.now() - tween.start) / tween.ms), e = ease(k);
    flyEnd.copy(tween.t1).addScaledVector(tween.dir, tween.dist());
    camera.position.lerpVectors(tween.p0, flyEnd, e); controls.target.lerpVectors(tween.t0, tween.t1, e);
    const [ox, oy] = offTarget(); setViewOff(tween.o0.x + (ox - tween.o0.x) * e, tween.o0.y + (oy - tween.o0.y) * e);
    if (k >= 1) { tween = null; controls.enabled = true; controls.maxDistance = zoomOutLimit(); }
  }
  if (!tween) { clampPan(); stepViewOffset(dt); }
  controls.update();
  // shadows: every frame while things fly around, every 2nd frame inside a room, every 8th on the grid
  if (trans || tween || frame % (focusPlot ? 2 : 8) === 0) renderer.shadowMap.needsUpdate = true;
  trackSpeed(nowMs);
  if (pointerIn && !tween && (pointerDirty || frame % 10 === 0)) { pointerDirty = false; setHover(pick()); }
  renderer.render(scene, camera);
  runJobs(performance.now());   // background room building, after this frame's drawing is sent
  requestAnimationFrame(loop);
}

/* ---------- boot: the heavy work happens behind the loading screen ----------
   1. fonts and Enhe's room. 2. the list of rooms, and any baked rooms already in this browser's cache.
   3. every room's far version (cached, or built and baked), with a progress bar. 4. every shader compiled and
   everything sent to the graphics card. Then the reveal and the fly-in. Full detail for the nearest rooms
   comes after that, in the background (see jobs). A slow database never holds the page: after 8 seconds the
   grid shows with Enhe's room, and the other rooms fade in as they arrive. */
const withTimeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(false), ms))]);
const breathe = () => new Promise(r => setTimeout(r, 0));   // let the page paint the progress bar (works in background tabs too)
function setLoad(text, frac) { $('loadText').textContent = text; $('loadBar').style.transform = `scaleX(${frac})`; }
function reveal(loaded) {
  revealed = true;
  $('loading').classList.add('gone');
  if (!followLink(loaded)) goOverview(); // the fly-in: into the room a shared link asks for, or over the whole grid
  spStart = performance.now() + 2500;    // judge the frame rate once the fly-in is over
  showBgLoad();
  loop();
}

setLoad('Building the grid…', 0.04);
fontsOk = await withTimeout(Promise.all([document.fonts.load('700 64px "Chakra Petch"'), document.fonts.load('600 40px Caveat')]).then(() => true).catch(() => false), 3000);
setGridR(MIN_R);
// Enhe's room is built in full up front (you can click its things straight away) and also gets a baked version, for
// when it's far off or the device is slow. Its lamps move up onto the room itself, so they light whichever version shows.
const homeDetail = new THREE.Group(); homeRoot.add(homeDetail);
homeRm = createHomeRoom(homeDetail, fontsOk);
homeDetail.children.filter(o => o.isLight).forEach(l => homeRoot.add(l));
homePl = addPlace(HOME, 'home', homeRoot, { room: null, detail: { group: homeDetail, state: 'ready' } });
try { const saved = sessionStorage.getItem('rg-code'); if (saved) $('codeInput').value = saved; } catch {}
camera.position.set(170, 190, 170); controls.target.set(0, 0, 0); controls.update();
renderChrome(); setControlMode(true);
setLoad('Loading rooms…', 0.1);

const roomsP = (async () => {
  backend = await createBackend();
  if (backend.mode === 'demo') showNotice('Demo mode: rooms you save stay in this browser only until Supabase is connected (see README).');
  else if (backend.authError) showNotice('Google sign-in did not work: ' + backend.authError);
  const list = await backend.listRooms();
  cached = await roomCache.readMany(list.map(r => roomCache.cacheKey(r.owner, sigOf(r))));
  return list;
})().catch(e => { console.warn(e); showNotice(`Could not load rooms right now. Showing ${HOME_NAME} only.`); return null; });

// while the rooms load: Enhe's room's baked version, from the browser cache or baked now (about 50 ms)
const HOME_KEY = roomCache.cacheKey('home', typeof __HOME_BUILD__ !== 'undefined' ? __HOME_BUILD__ : 'dev');
{
  let data = (await withTimeout(roomCache.readMany([HOME_KEY]), 1500) || new Map()).get(HOME_KEY);
  if (!data) { data = bakeRoom(homeDetail); roomCache.write(HOME_KEY, data); }
  homePl.far = farLayer(data, { title: HOME_NAME }, fontsOk); homeRoot.add(homePl.far); refreshMats(homePl);
}

const early = await withTimeout(roomsP, 8000);
if (early) {
  applyRooms(early);
  const total = pending.size, until = performance.now() + 8000;   // a huge grid: the rest load after the reveal
  while (pending.size && performance.now() < until) {
    const t0 = performance.now();
    while (pending.size && performance.now() - t0 < 50) makeFar(nearestPending());
    setLoad(`Loading rooms ${total - pending.size} of ${total}`, 0.1 + 0.8 * (total - pending.size) / Math.max(1, total));
    await breathe();
  }
  updateOcclusion();
}
setLoad('Almost there…', 0.94);
await breathe();
await withTimeout(renderer.compileAsync(scene, camera).then(() => true, () => true), 5000);   // every shader, off the main thread where the browser allows
renderer.shadowMap.needsUpdate = true;
renderer.render(scene, camera);   // hidden under the loading screen: sends the rooms and their pictures to the graphics card
setLoad('Almost there…', 1);
reveal(!!early);

const list = early || await roomsP;   // a slow database: the rooms arrive after the reveal and fade in
if (list && !early) applyRooms(list);
if (!early) {   // and only now can a shared link find its room (unless the rooms never came, or you've gone into one meanwhile)
  if (!list || focusPlot !== null) linkWait = null;
  followLink(true); syncUrl();
}
if (backend) {
  backend.subscribe(l => applyRooms(l));
  backend.onAuth(async () => { try { applyRooms(await backend.listRooms()); } catch {} if (!addPanel.hidden) renderAddState(); });
  roomCache.keepOnly([HOME_KEY, ...rooms.map(r => roomCache.cacheKey(r.owner, sigOf(r)))]);   // forget rooms that changed or left
  // back from Google sign-in: reopen the add panel and finish adding the room
  let resume = null; try { resume = sessionStorage.getItem('rg-resume'); sessionStorage.removeItem('rg-resume'); } catch {}
  if (resume && backend.me && $('codeInput').value.trim()) {
    openAdd(resume !== '1' ? resume : undefined);
    $('saveBtn').click();
  }
}
