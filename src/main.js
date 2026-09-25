import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './style.css';
import { canvasTex } from './three-helpers.js';
import { disposeGroup } from './kit.js';
import { createHomeRoom, HOT, HOT_BY_ID, KIND } from './homeRoom.js';
import { parseRoomCode, buildRecipeRoom, DEEP_PROMPT } from './recipe.js';
import { createBackend } from './backend.js';

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
function clampPan() {   // keep the grid on screen: the point you look at stays on the grid
  const t = controls.target;
  const L = panLimit(); panShift.set(THREE.MathUtils.clamp(t.x, -L, L) - t.x, -t.y, THREE.MathUtils.clamp(t.z, -L, L) - t.z);
  if (panShift.lengthSq() > 1e-8) { t.add(panShift); camera.position.add(panShift); }
}
const DIR = new THREE.Vector3(1, 0.78, 1).normalize();
const ROOM_DIR = new THREE.Vector3(1, 0.5, 1).normalize();
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
  const m = new THREE.LineBasicMaterial({ color: GRID, transparent: true, opacity: 0.14, depthWrite: false });
  const e = new THREE.LineSegments(edgeGeo, m); e.position.set(p.x - 0.05, 3.05, p.z - 0.05); scene.add(e);
  empties.set(k, { lines: e, phase: Math.random() * 6.28, hot: false });
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

/* ---------- places (rooms that exist in the world) ---------- */
const places = new Map(); // key -> { kind, root, room, anims, objGroups, lift, dim, dimShown, mats, lights }
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
  const pl = { kind, root, lift: 0, dim: 0, dimShown: 0, mats, lights, near: true, ...extra };
  places.set(k, pl);
  const e = empties.get(k); if (e) e.lines.visible = false;
  return pl;
}
function removePlace(k) {
  const pl = places.get(k); if (!pl || pl.kind === 'home') return;
  disposeGroup(pl.root); places.delete(k);
  const e = empties.get(k); if (e) e.lines.visible = true;
}
let fontsOk = false;
function placeRoom(k, room, kind = 'guest') {
  removePlace(k);
  const root = new THREE.Group(); root.position.copy(posOf(k)); scene.add(root);
  const built = buildRecipeRoom(root, room, fontsOk);
  return addPlace(k, kind, root, { room, anims: built.anims, objGroups: built.objGroups, decor: built.decor });
}

/* ---------- state ---------- */
let homeRm = null;
let focusPlot = null;      // null = the whole grid
let activeHot = null;      // a thing in the home room
let activeObj = null;      // { k, i } a thing in someone's room
let hovered = null;
let motionOn = !reduced;

/* ---------- camera ---------- */
let tween = null;
function flyTo(pos, target, ms = 1100, start = performance.now()) { tween = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: target, start, ms: reduced ? 1 : ms }; controls.enabled = false; }
// change which room is in focus: the room rises, the rest fades to black and the camera flies in, all together
function setFocus(k) { if (focusPlot === k) return false; focusPlot = k; setControlMode(k === null); startTrans(); updateOcclusion(); return true; }
const aspect = () => canvas.clientWidth / Math.max(1, canvas.clientHeight);
function roomDist() { const a = aspect(); return a < 0.7 ? 40 : a < 1 ? 33 : a < 1.4 ? 27 : 24; }
function overviewDist() { return (aspect() < 0.8 ? 215 : 128) * Math.max(7, 2 * gridR + 1) / 9; }
function fitRange() { // how far the camera can pull back and see, for the current grid size
  const d = overviewDist();
  controls.maxDistance = Math.max(230, d * 1.8);
  scene.fog.near = Math.max(90, d * 0.7); scene.fog.far = Math.max(240, d * 1.9);
  camera.far = Math.max(500, scene.fog.far + 60); camera.updateProjectionMatrix();
}
function goRoom(k) {
  const moved = setFocus(k); activeHot = null; activeObj = null;
  // the camera aims at where the room ends up, so it glides in as the room rises
  const t = posOf(k).add(new THREE.Vector3(0, LIFT + 1.2, 0));
  flyTo(t.clone().addScaledVector(ROOM_DIR, roomDist() * 1.15), t, moved ? TRANS_MS : 1100, moved && trans ? trans.t0 : undefined);
  aimShadow(posOf(k).add(new THREE.Vector3(0, LIFT, 0)));
  renderChrome();
}
function goOverview() {
  const moved = setFocus(null); activeHot = null; activeObj = null; hidePanel();
  const t = new THREE.Vector3(0, 0, 0), dir = new THREE.Vector3(1, 1.25, 1).normalize();
  flyTo(t.clone().addScaledVector(dir, overviewDist()), t, moved ? TRANS_MS : 1400, moved && trans ? trans.t0 : undefined);
  renderChrome();
}
function focusHot(id) {
  const h = HOT_BY_ID[id]; if (!h) return;
  const moved = setFocus(HOME); if (moved) aimShadow(new THREE.Vector3(0, LIFT, 0));
  activeHot = id; activeObj = null;
  const t = new THREE.Vector3(h.t[0], h.t[1] + LIFT, h.t[2]), dir = new THREE.Vector3(...h.dir).normalize();
  flyTo(t.clone().addScaledVector(dir, h.d * (canvas.clientWidth < 700 ? 1.35 : 1)), t, moved ? TRANS_MS : 1100, moved && trans ? trans.t0 : undefined);
  showHot(h); renderChrome();
}
function focusObj(k, i) {
  const pl = places.get(k); if (!pl || !pl.objGroups?.[i]) return;
  const moved = setFocus(k); if (moved) aimShadow(posOf(k).add(new THREE.Vector3(0, LIFT, 0)));
  activeHot = null; activeObj = { k, i };
  const wp = new THREE.Vector3(); pl.objGroups[i].getWorldPosition(wp); wp.y = LIFT + 1.4;
  flyTo(wp.clone().addScaledVector(new THREE.Vector3(0.6, 0.55, 1).normalize(), canvas.clientWidth < 700 ? 11 : 8.5), wp, moved ? TRANS_MS : 1100, moved && trans ? trans.t0 : undefined);
  showObj(pl.room, i); renderChrome();
}

/* hide rooms that sit between the camera and the one in focus */
let blocked = new Set();
function updateOcclusion() {
  blocked = new Set();
  const f = focusPlot ? parseKey(focusPlot) : null;
  const test = k => { if (!f) return false; const [px, pz] = parseKey(k); const dx = px - f[0], dz = pz - f[1]; const b = dx >= 0 && dz >= 0 && dx + dz > 0 && dx <= 2 && dz <= 2; if (b) blocked.add(k); return b; };
  hitboxes.forEach(h => test(h.userData.plot));
  places.forEach((pl, k) => { pl.root.visible = !blocked.has(k); });
  empties.forEach((e, k) => { e.lines.visible = !places.has(k) && !buildQueue.has(k) && !blocked.has(k) && ring(k) <= gridR; });
}

/* ---------- panels ---------- */
const panel = $('panel'), addPanel = $('addPanel');
function hidePanel() { panel.hidden = true; }
function setKind(color, text) { panel.style.setProperty('--c', color); const kd = $('pKind'); kd.style.setProperty('--c', color); kd.lastElementChild.textContent = text; }
function setLinks(list) {
  const row = $('pLinks'); row.replaceChildren();
  list.filter(l => l && l.url).forEach(l => { const a = document.createElement('a'); a.className = 'next'; a.href = l.url; a.target = '_blank'; a.rel = 'noopener noreferrer nofollow'; a.textContent = l.label + ' \u2197'; row.appendChild(a); });
  row.hidden = !row.childElementCount;
}
function panelBasics(title, body, stack) { $('pTitle').textContent = title; $('pBody').textContent = body; $('pStack').textContent = stack || ''; $('pTags').replaceChildren(); $('pSaved').hidden = true; $('mineRow').hidden = true; $('reportRow').hidden = true; }
// the buttons at the bottom of the card: a room card leads back to the grid, a thing card leads back to its room
function setActions(kind) {
  $('backBtn').lastElementChild.textContent = kind === 'room' ? 'Back to the grid' : 'Back to the room';
  $('lookBtn').hidden = kind !== 'room';
  $('nextBtn').hidden = kind === 'room';
}
function showHot(h) {
  const k = KIND[h.kind];
  setKind(k.color, h.kind === 'build' ? 'Project · ' + h.name : k.label);
  panelBasics(h.title, h.body, h.stack);
  setLinks(h.link ? [{ url: h.link, label: h.linkLabel }] : []);
  setActions('thing'); panel.hidden = false;
}
const TYPE_COLOR = { project: '#FF8A4C', interest: '#2CC4B3', about: '#F2C14E' };
function showRoomCard(room, isPreview, justSaved) {
  setKind(room.color, isPreview ? 'Preview · not saved yet' : 'Room');
  panelBasics(room.title, room.bio || 'No bio yet.', '');
  const tags = $('pTags');
  room.objects.forEach((o, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'tag'; b.style.setProperty('--c', TYPE_COLOR[o.type]); b.textContent = o.name; b.addEventListener('click', () => focusObj(keyOfRoom(room), i)); tags.appendChild(b); });
  setLinks(room.links || []);
  setActions('room');
  const mine = !isPreview && backend && room.owner === backend.me;
  $('mineRow').hidden = !mine; $('pSaved').hidden = !(mine && justSaved);
  if (mine) setKind(room.color, room.hidden ? 'Your room · hidden after reports' : 'Your room');
  const canReport = !isPreview && !mine && room.owner && backend?.mode === 'live';
  $('reportRow').hidden = !canReport; $('reportStatus').textContent = '';
  const rb = $('reportBtn'); rb.hidden = false; rb.dataset.owner = room.owner || ''; rb.dataset.confirm = '';
  rb.textContent = backend?.me ? 'Report it' : 'Sign in to report';
  panel.hidden = false;
}
function showObj(room, i) {
  const o = room.objects[i];
  setKind(TYPE_COLOR[o.type], `${room.title} · ${o.type === 'project' ? 'Project' : o.type === 'about' ? 'About' : 'Interest'}`);
  panelBasics(o.name, o.about || '', o.kit ? '' : `${o.parts ? o.parts.length : 0} parts`);
  setLinks(o.link ? [{ url: o.link, label: 'Open link' }] : []);
  setActions('thing'); panel.hidden = false;
}
function keyOfRoom(room) { for (const [k, pl] of places) if (pl.room === room) return k; return null; }
// leave a thing card: fly back out to the whole room (and show the room's card again)
function backToRoom() { hidePanel(); const k = focusPlot; activeHot = null; activeObj = null; if (!k) return; goRoom(k); const pl = places.get(k); if (pl?.room) showRoomCard(pl.room); }
$('backBtn').addEventListener('click', () => { if (activeHot || activeObj) backToRoom(); else { hidePanel(); goOverview(); } });
$('lookBtn').addEventListener('click', () => hidePanel());
$('nextBtn').addEventListener('click', () => {
  if (activeHot) { const i = HOT.findIndex(h => h.id === activeHot); focusHot(HOT[(i + 1) % HOT.length].id); return; }
  if (activeObj) { const pl = places.get(activeObj.k); if (pl) focusObj(activeObj.k, (activeObj.i + 1) % pl.room.objects.length); }
});

/* ---------- header + dock ---------- */
function renderChrome() {
  const pl = focusPlot ? places.get(focusPlot) : null;
  $('placeName').textContent = focusPlot === null ? 'The Grid' : focusPlot === HOME ? "Home Room" : (pl?.room?.title || 'Empty square');
  $('hint').textContent = focusPlot === null ? 'Every square is a room. Click one to bring it up. Drag to move around, right-drag to turn.' : 'Drag to look around. Scroll to zoom. Click anything in the room.';
  $('viewBtn').hidden = focusPlot === null;   // only shown inside a room, to go back to the grid
  const n = rooms.length + 1;
  $('stats').textContent = `Cubby · ${n} room${n === 1 ? '' : 's'}`;
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
    chip("Home room", '#E8402F', false, () => { hidePanel(); goRoom(HOME); });
    rooms.forEach(r => chip(r.title, r.color, false, () => { const k = keyOf(r.px, r.pz); const pl = buildNow(k); goRoom(k); if (pl) showRoomCard(pl.room); }));
    if (!rooms.length) label('No other rooms yet. Add yours.');
  }
}
$('viewBtn').addEventListener('click', () => goOverview());
const motionBtn = $('motionBtn');
motionBtn.textContent = motionOn ? 'Pause' : 'Play';
motionBtn.addEventListener('click', () => { motionOn = !motionOn; motionBtn.textContent = motionOn ? 'Pause' : 'Play'; });

/* ---------- saved rooms in the world ---------- */
const sigOf = r => JSON.stringify([r.title, r.bio, r.color, r.links, r.objects]);
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
  [...places.entries()].forEach(([k, pl]) => { if (pl.kind === 'guest' && (!wanted.has(k) || pl.sig !== sigOf(wanted.get(k)) || pl.room.owner !== wanted.get(k).owner)) removePlace(k); });
  buildQueue.forEach((r, k) => { if (!wanted.has(k)) buildQueue.delete(k); });
  // new rooms are built a few per frame, nearest first, so a big grid never freezes the page
  wanted.forEach((r, k) => { const pl = places.get(k); if (pl && pl.kind === 'guest') { pl.room = r; return; } if (!pl) buildQueue.set(k, r); });
  updateOcclusion(); renderChrome();
  $('addBtn').textContent = myRoom ? 'Your room' : 'Add your room';
}

const buildQueue = new Map();   // square -> room waiting to be built
function buildNow(k) {
  const r = buildQueue.get(k); if (!r) return places.get(k);
  buildQueue.delete(k);
  const pl = placeRoom(k, r); pl.sig = sigOf(r);
  if (focusPlot && k !== focusPlot) { pl.dim = 1; applyDim(pl); }  // arrives already faded if another room is in focus
  return pl;
}
function pumpBuilds(budgetMs) {
  if (!buildQueue.size) return;
  const t0 = performance.now(), c = controls.target;
  const order = [...buildQueue.keys()].sort((a, b) => posOf(a).distanceToSquared(c) - posOf(b).distanceToSquared(c));
  for (const k of order) { buildNow(k); if (performance.now() - t0 > budgetMs) break; }
  updateOcclusion();
}

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
  if (!backend.user) { line.textContent = 'Adding a room needs a quick Google sign-in (one room per account). Looking around never does.'; return; }
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
$('addBtn').addEventListener('click', () => { if (myRoom && addPanel.hidden) { const k = keyOf(myRoom.px, myRoom.pz); buildNow(k); goRoom(k); showRoomCard(places.get(k)?.room || myRoom); } else openAdd(); });
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
    try { await backend.signIn(); } catch (e) { st.textContent = e?.message || 'Could not start sign-in.'; btn.disabled = false; }
    return;
  }
  const [px, pz] = parseKey(k);
  btn.disabled = true; st.textContent = 'Saving...';
  try {
    await backend.saveRoom(room, px, pz);
    addPanel.hidden = true; delete addPanel.dataset.target; st.textContent = '';
    try { sessionStorage.removeItem('rg-code'); } catch {}
    applyRooms(await backend.listRooms());
    const pl = buildNow(k); goRoom(k); if (pl) showRoomCard(pl.room, false, true);
  } catch (e) { st.textContent = e?.message || 'Could not save. Try again.'; }
  finally { btn.disabled = false; }
});
$('codeInput').addEventListener('input', () => { try { sessionStorage.setItem('rg-code', $('codeInput').value); } catch {} });
$('editBtn').addEventListener('click', () => {
  if (!myRoom) return;
  const { owner, px, pz, id, createdAt, ...code } = myRoom;
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
  if (h.id === HOME) return { text: "Home room", color: '#E8402F' };
  const pl = places.get(h.id), q = buildQueue.get(h.id);
  if (pl || q) { const r = pl ? pl.room : q; return { text: r.title, color: r.color }; }
  return { text: addPanel.hidden ? 'Empty square · add your room' : 'Put my room here', color: GRID };
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
canvas.addEventListener('pointerup', e => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6 || tween) { downAt = null; return; }
  downAt = null; setPointer(e);
  const h = pick(); if (!h) return;
  if (h.type === 'hot') { focusHot(h.id); return; }
  if (h.type === 'obj') { focusObj(h.k, h.i); return; }
  const k = h.id, pl = buildNow(k);
  if (k === HOME) { if (focusPlot !== HOME) { hidePanel(); goRoom(HOME); } return; }
  if (pl) { if (focusPlot !== k) goRoom(k); showRoomCard(pl.room); return; }
  if (!focusPlot) openAdd(k);
});
window.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (!addPanel.hidden) closeAdd(); else if (!panel.hidden) { if (activeHot || activeObj) backToRoom(); else hidePanel(); } });

/* ---------- boot ---------- */
function resize() { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix(); fitRange(); }
new ResizeObserver(resize).observe(canvas); resize();
const withTimeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(false), ms))]);
fontsOk = await withTimeout(Promise.all([document.fonts.load('700 64px "Chakra Petch"'), document.fonts.load('600 40px Caveat')]).then(() => true).catch(() => false), 3000);
setGridR(MIN_R);
homeRm = createHomeRoom(homeRoot, fontsOk);
addPlace(HOME, 'home', homeRoot, { room: null });
try { const saved = sessionStorage.getItem('rg-code'); if (saved) $('codeInput').value = saved; } catch {}

camera.position.set(170, 190, 170); controls.target.set(0, 0, 0);
renderChrome();
setControlMode(true);
goOverview();   // open on the whole grid
$('loading').classList.add('gone');

/* ---------- load saved rooms ---------- */
backend = await createBackend();
if (backend.mode === 'demo') showNotice('Demo mode: rooms you save stay in this browser only until Supabase is connected (see README).');
else if (backend.authError) showNotice('Google sign-in did not work: ' + backend.authError);
try { applyRooms(await backend.listRooms()); } catch (e) { console.warn(e); showNotice('Could not load rooms right now. Showing the home room only.'); }
if (focusPlot === null && gridR > MIN_R) goOverview();
backend.subscribe(list => applyRooms(list));
backend.onAuth(async () => { try { applyRooms(await backend.listRooms()); } catch {} if (!addPanel.hidden) renderAddState(); });
// back from Google sign-in: reopen the add panel and finish adding the room
let resume = null; try { resume = sessionStorage.getItem('rg-resume'); sessionStorage.removeItem('rg-resume'); } catch {}
if (resume && backend.me && $('codeInput').value.trim()) {
  openAdd(resume !== '1' ? resume : undefined);
  $('saveBtn').click();
}
function showNotice(msg) { const n = $('notice'); n.textContent = msg; n.hidden = false; }

/* ---------- keep it smooth: lower the sharpness when frames get slow ---------- */
// Each step draws fewer pixels. If a step is still too slow, it moves down again and never climbs back to a step that lagged.
const STEPS = [DEVICE_PX, ...[1.5, 1.25, 1, 0.85, 0.7].filter(p => p < DEVICE_PX - 0.01)];
const tooSlow = new Set();
let step = 0; try { step = Math.min(STEPS.length - 1, Math.max(0, Number(localStorage.getItem('cubby-quality')) || 0)); } catch {}
function applyStep() {
  renderer.setPixelRatio(STEPS[step]);
  const size = STEPS[step] >= 1.25 ? 2048 : 1024, shadowsOn = STEPS[step] >= 1 || STEPS.length === 1;
  if (key.castShadow !== shadowsOn) key.castShadow = shadowsOn;
  if (key.shadow.mapSize.x !== size) { key.shadow.mapSize.set(size, size); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
  resize(); renderer.shadowMap.needsUpdate = true;
  try { localStorage.setItem('cubby-quality', String(step)); } catch {}
}
let spWin = 0, spFrames = 0, spLast = 0, spGood = 0, spStart = performance.now() + 3000;
function trackSpeed(now) {
  const gap = now - spLast; spLast = now;
  if (now < spStart || document.hidden || gap > 250) return;   // skip start-up and tab switches
  spWin += gap; spFrames++;
  if (spWin < 2000) return;
  const avg = spWin / spFrames; spWin = 0; spFrames = 0;
  if (avg > 25 && step < STEPS.length - 1) { tooSlow.add(step); step++; spGood = 0; applyStep(); spStart = now + 1500; }  // under ~40 fps
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
    pl.root.visible = !blocked.has(k) && pl.dim < 0.995 && !pl.farOut;
  });
  const gT = kSel ? 1 : 0, uD = groundMat.uniforms.uDim;
  if (trans) uD.value = trans.g + (gT - trans.g) * te; else uD.value += (gT - uD.value) * Math.min(1, dt * 3);
  const u = uD.value, keep = 1 - u;
  scene.background.copy(BG).lerp(BLACK, u); scene.fog.color.copy(scene.background); groundMat.uniforms.uBg.value.copy(scene.background);
  rain.material.opacity = 0.5 * keep; rain.visible = keep > 0.005;
  empties.forEach((e, k) => { const lit = e.hot || (k === addTarget && !addPanel.hidden); e.lines.material.opacity = lit ? 0.75 * keep : (0.1 + 0.07 * (0.5 + 0.5 * Math.sin(elapsed * 1.6 + e.phase))) * keep; });
  if (trans && te >= 1) trans = null;
  if (motionOn) {
    elapsed += dt;
    groundMat.uniforms.uTime.value = elapsed;
    stepRain(dt);
    if (camera.position.distanceTo(posOf(HOME)) < 75) { homeRm.animators.forEach(f => f(dt, elapsed)); tvAcc += dt; if (tvAcc > 1 / 24) { tvAcc = 0; homeRm.drawTV(elapsed); } }
    places.forEach(pl => { if (pl.anims && pl.near && pl.root.visible) pl.anims.forEach(f => f(dt, elapsed)); });
  }
  const nowMs = performance.now();
  // level of detail: far rooms show only their walls; rooms lost in the fog are not drawn at all
  if (nowMs - lastLod > 300) {
    lastLod = nowMs; const fogOut = scene.fog.far + 20;
    places.forEach((pl, k) => {
      const d = camera.position.distanceTo(pl.root.position);
      pl.farOut = k !== focusPlot && d > fogOut;
      if (pl.kind === 'home') return;
      const near = d < 80;
      if (near !== pl.near) { pl.near = near; (pl.objGroups || []).forEach(g => { g.visible = near; }); if (pl.decor) pl.decor.visible = near; }
    });
  }
  if (tween) {
    const k = Math.min(1, (performance.now() - tween.start) / tween.ms), e = ease(k);
    camera.position.lerpVectors(tween.p0, tween.p1, e); controls.target.lerpVectors(tween.t0, tween.t1, e);
    if (k >= 1) { tween = null; controls.enabled = true; }
  }
  if (focusPlot === null && !tween) clampPan();
  pumpBuilds(tween || trans ? 4 : 10);
  controls.update();
  // shadows: every frame while things fly around, every 2nd frame inside a room, every 8th on the grid
  if (trans || tween || frame % (focusPlot ? 2 : 8) === 0) renderer.shadowMap.needsUpdate = true;
  trackSpeed(nowMs);
  if (pointerIn && !tween && (pointerDirty || frame % 10 === 0)) { pointerDirty = false; setHover(pick()); }
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
loop();
