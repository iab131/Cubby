import * as THREE from 'three';
import { mat, box, plane, canvasTex, rr, hashStr, screenMat, glowMat } from './three-helpers.js';
import { COLORS, KIT_IDS } from './kitList.js';
import { B, SLOTS, neonSign, initialPoster } from './kit.js';
import { cleanDecor, defaultDecor, buildDecor, applyMood } from './decor.js';

/* ---------- room recipes: the safe "room code" format ---------- */
export const LIMITS = { objects: 10, partsPerObject: 60, partsTotal: 400, links: 3 };
const SHAPES = ['box', 'ball', 'cylinder', 'cone', 'ring', 'sign'];
const TYPES = ['project', 'interest', 'about'];
const txt = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const num = (v, lo, hi, d = 0) => { const x = Number(v); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };
const hex = (v, d) => /^#[0-9a-fA-F]{6}$/.test(String(v || '')) ? String(v) : d;
const vec = (v, n, lo, hi, d) => { const a = Array.isArray(v) ? v : []; return Array.from({ length: n }, (_, i) => num(a[i], lo, hi, d[i])); };
function safeUrl(u) {
  let s = txt(u, 200); if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try { const x = new URL(s); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; }
}

/* Turn whatever someone pasted into a clean recipe, or throw a plain-English error. */
export function parseRoomCode(input) {
  const raw = String(input || '');
  const a = raw.indexOf('{'), b = raw.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('That does not look like a room code. It should start with { and end with }.');
  let data;
  try { data = JSON.parse(raw.slice(a, b + 1)); } catch { throw new Error('The room code is broken (not valid JSON). Ask your Claude to send it again as one code block.'); }
  return cleanRecipe(data);
}
export function cleanRecipe(r) {
  if (!r || typeof r !== 'object') throw new Error('The room code is empty.');
  const out = {
    v: 1,
    id: txt(r.id, 40) || ('r' + Math.random().toString(36).slice(2, 10)),
    title: txt(r.title, 40) || 'New room',
    bio: txt(r.bio, 220),
    color: hex(r.color, COLORS[4]),
    links: (Array.isArray(r.links) ? r.links : []).slice(0, LIMITS.links).map(l => ({ label: txt(l?.label, 24) || 'Link', url: safeUrl(l?.url) })).filter(l => l.url),
    objects: [],
    decor: cleanDecor(r.decor),
    px: Number.isInteger(r.px) ? r.px : null, pz: Number.isInteger(r.pz) ? r.pz : null
  };
  let total = 0;
  for (const o of (Array.isArray(r.objects) ? r.objects : []).slice(0, LIMITS.objects)) {
    if (!o || typeof o !== 'object') continue;
    const obj = { name: txt(o.name, 40) || 'Something', type: TYPES.includes(o.type) ? o.type : 'interest', about: txt(o.about, 300), link: safeUrl(o.link) };
    if (o.at !== undefined) obj.at = vec(o.at, 2, -4.6, 4.6, [0, 0]);
    obj.turn = num(o.turn, -360, 360, 0);
    if (KIT_IDS.includes(o.kit)) obj.kit = o.kit;
    const parts = [];
    for (const p of (Array.isArray(o.parts) ? o.parts : []).slice(0, LIMITS.partsPerObject)) {
      if (!p || !SHAPES.includes(p.shape) || total >= LIMITS.partsTotal) continue;
      const part = { shape: p.shape, size: vec(p.size, 3, 0.02, 4, [0.5, 0.5, 0.5]), pos: vec(p.pos, 3, -3.5, 6.5, [0, 0, 0]), rot: vec(p.rot, 3, -360, 360, [0, 0, 0]), color: hex(p.color, '#CCCCCC') };
      part.pos[0] = num(part.pos[0], -3.5, 3.5); part.pos[1] = num(part.pos[1], 0, 6.5); part.pos[2] = num(part.pos[2], -3.5, 3.5);
      if (p.glow) part.glow = true;
      if (p.shiny) part.shiny = true;
      if (p.shape === 'sign') part.text = txt(p.text, 28);
      parts.push(part); total++;
    }
    if (!obj.kit && !parts.length) continue;
    if (parts.length) obj.parts = parts;
    out.objects.push(obj);
  }
  if (!out.objects.length) throw new Error('The room code has no objects in it. Ask your Claude to add some.');
  return out;
}

/* Draw one custom object from its parts. Each shape is a unit shape stretched to `size`. */
const UNIT = {};
function unitGeo(shape) {
  return UNIT[shape] ??= ({
    box: () => new THREE.BoxGeometry(1, 1, 1),
    ball: () => new THREE.SphereGeometry(0.5, 20, 14),
    cylinder: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 20),
    cone: () => new THREE.ConeGeometry(0.5, 1, 20),
    ring: () => new THREE.TorusGeometry(0.44, 0.06, 10, 36)
  })[shape]();
}
function buildParts(g, parts, fontFamily) {
  for (const p of parts) {
    let mesh;
    if (p.shape === 'sign') {
      const t = canvasTex(512, 128, (x, w, h) => {
        x.fillStyle = '#121116'; rr(x, 4, 4, w - 8, h - 8, 18); x.fill();
        x.strokeStyle = p.color; x.lineWidth = 6; rr(x, 6, 6, w - 12, h - 12, 16); x.stroke();
        x.fillStyle = p.color; x.textAlign = 'center'; x.textBaseline = 'middle';
        let s = 64; x.font = `700 ${s}px ${fontFamily}`; while (x.measureText(p.text || '').width > w - 40 && s > 20) { s -= 4; x.font = `700 ${s}px ${fontFamily}`; }
        x.fillText(p.text || '', w / 2, h / 2 + 2);
      }).t;
      mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, toneMapped: false, side: THREE.DoubleSide }));
      mesh.scale.set(p.size[0], p.size[1], 1);
    } else {
      const m = mat(p.color, p.shiny ? 0.25 : 0.7, p.shiny ? 0.5 : 0, p.glow ? { emissive: p.color, emissiveIntensity: 0.9 } : {});
      mesh = new THREE.Mesh(unitGeo(p.shape), m);
      mesh.scale.set(p.size[0], p.size[1], p.size[2]);
    }
    mesh.position.set(p.pos[0], p.pos[1], p.pos[2]);
    mesh.rotation.set(THREE.MathUtils.degToRad(p.rot[0]), THREE.MathUtils.degToRad(p.rot[1]), THREE.MathUtils.degToRad(p.rot[2]));
    g.add(mesh);
  }
}

/* A visitor's room: shell tinted with their colour, then their objects. */
export function buildRecipeRoom(parent, room, fontsReady) {
  const FONT = fontsReady ? '"Chakra Petch"' : 'system-ui';
  const g = new THREE.Group(); parent.add(g);
  const anims = [];
  const c = room.color;
  const tint = (base, amt) => '#' + new THREE.Color(base).lerp(new THREE.Color(c), amt).getHexString();
  const wall = mat(tint('#D9CBB3', 0.22), 0.9), wall2 = mat(tint('#CDBDA2', 0.3), 0.9), cap = mat('#2C2832', 0.8), side = mat('#25222B', 0.8);
  box(10.5, 0.4, 10.5, side, -0.05, -0.2, -0.05, g);
  const floor = plane(10.3, 10.3, mat(tint('#6E4A36', 0.12), 0.8), -0.05, 0.002, -0.05, g); floor.rotation.x = -Math.PI / 2;
  box(10.6, 6.9, 0.3, [wall, wall, cap, wall, wall, wall], -0.05, 3.05, -5.15, g);
  box(0.3, 6.9, 10.3, [wall2, wall2, cap, wall2, wall2, wall2], -5.15, 3.05, 0.05, g);
  box(10.1, 0.22, 0.06, mat('#3B3440', 0.7), 0.1, 0.11, -4.97, g); box(0.06, 0.22, 10.1, mat('#3B3440', 0.7), -4.97, 0.11, 0.1, g);
  const rug = box(5.2, 0.03, 4.2, mat(tint('#3A3440', 0.55), 0.95), 0.2, 0.017, 0.6, g, 0.01);
  for (const [w, d, x, z] of [[10.5, 0.05, -0.05, 5.2], [0.05, 10.5, 5.2, -0.05]]) box(w, 0.05, d, glowMat(c), x, 0.0, z, g);
  plane(5.2, 1.1, neonSign(room.title, c, FONT), 0, 5.6, -4.97, g);
  const seed = hashStr(room.id || room.title);
  const decor = room.decor || defaultDecor(seed);
  // the name poster on the left wall moves out of the way of a window there
  let pz = 0.4; const win = decor.window;
  if (win && win.wall === 'left' && Math.abs(win.at - pz) < 2.7) { pz = win.at >= pz ? win.at - 2.7 : win.at + 2.7; if (Math.abs(pz) > 4.2) pz = win.at >= 0.4 ? win.at + 2.7 : win.at - 2.7; pz = Math.max(-4.2, Math.min(4.2, pz)); }
  const poster = plane(1.1, 1.54, screenMat(initialPoster(room.title, room.bio || '', c, FONT)), -4.96, 3.3, pz, g); poster.rotation.y = Math.PI / 2;
  box(0.05, 1.64, 1.2, mat('#0F0E13', 0.6), -4.99, 3.3, pz, g);
  applyMood([wall, wall2, floor.material, rug.material], decor.lights?.mood || 'warm');
  const dg = new THREE.Group(); g.add(dg);
  buildDecor(dg, decor, { seed, color: c, font: FONT, anims, posterSpot: { wall: 'left', at: pz, y: 3.3, w: 1.2, h: 1.64 } });
  let slot = 0;
  const objGroups = [];
  room.objects.forEach((o, i) => {
    const og = new THREE.Group(); og.userData.obj = i; g.add(og); objGroups.push(og);
    let x, z, ry;
    if (o.at) { [x, z] = o.at; ry = THREE.MathUtils.degToRad(o.turn || 0); }
    else { const s = SLOTS[slot++ % SLOTS.length]; [x, z, ry] = s; if (o.turn) ry += THREE.MathUtils.degToRad(o.turn); }
    og.position.set(x, 0, z); og.rotation.y = ry;
    if (o.kit && B[o.kit]) { const kg = new THREE.Group(); kg.scale.setScalar(o.parts ? 1 : 1.3); og.add(kg); B[o.kit](kg, c, seed + i, anims); }
    if (o.parts) buildParts(og, o.parts, FONT);
  });
  g.traverse(o => { if (o.isMesh) { o.castShadow = !(o.material && o.material.isMeshBasicMaterial); o.receiveShadow = true; } });
  floor.castShadow = false; rug.castShadow = false;
  dg.traverse(o => { o.castShadow = false; }); // lamps and wall art shouldn't throw odd shadows
  return { group: g, anims, objGroups, decor: dg };
}

export const DEEP_PROMPT = `Build me a 3D room for Cubby.

Cubby is a 3D grid of little rooms where every room shows who someone is: their projects and their interests. I want my own room. Please design it and give me a "room code" I can paste into Cubby.

STEP 1. Learn about me.
- If you can see my files or project folders, look through them (READMEs, code, docs, notes) to find my real projects, what they do, and what I'm into.
- If you can't see my files, ask me up to 5 short questions first (what I build, what I study or work on, my hobbies, my favorite things). Wait for my answers.

STEP 2. Choose 5 to 8 objects for my room.
- Mix my projects (type "project") and my interests or hobbies (type "interest").
- Each object gets a short, friendly description ("about"), written about me in the third person, max 2 sentences. Keep it simple enough for a kid to understand.

STEP 3. Build each object from simple shapes, like digital LEGO.
Room layout (1 unit is about half a meter):
- Floor is y = 0. Walls are 6.5 high.
- x goes from -5 (left wall) to 5 (right side, open).
- z goes from -5 (back wall) to 5 (front, open, where the viewer stands).
- Put each object on the floor with "at": [x, z]. Keep x and z between -4.5 and 4.5, and keep objects about 2.5 units apart so they don't overlap.
- Each object is made of "parts". A part's "pos" is relative to the object's "at" spot (y is height above the floor). Keep pos x and z between -1.5 and 1.5.
- Shapes: "box", "ball", "cylinder", "cone", "ring" (a donut standing up, like a wheel), "sign" (a small label with "text").
- "size" is [width, height, depth] of the shape. "rot" is rotation in degrees [x, y, z]. "color" is a hex color.
- Optional on a part: "glow": true (it lights up), "shiny": true (metal or plastic look).
- Use 5 to 40 parts per object. Make it recognizable: a guitar needs a body, neck and head; a robot needs a body, wheels and a sensor.
- Instead of parts, an object can use a ready-made model with "kit": one of f1, badminton, soccer, basketball, climbing, guitar, piano, dj, books, plant, gaming, coding, robot, drone, camera, art, space, bike, skate, chess, gym, coffee, cat.

STEP 4. Make it feel like a real room: a window, pictures on the walls, and lighting. Always include all three, in "decor".
- Window (required): "window": { "wall": "back" or "left", "at": spot along that wall from -3 to 3, "view": one of city, sunset, forest, ocean, mountains, snow, space }. Pick a view that fits me (where I live, a place I love, or my vibe).
- Pictures (2 to 4): each is { "wall": "back" or "left", "at": spot along the wall from -4 to 4, "y": height of its center from 1.6 to 4.4, "size": [width, height] from 0.5 to 2, "style", "title", "colors" }.
  - "style": photo (a snapshot with a handwritten caption), poster (big bold title), abstract, mountains, sunset, portrait, or stripes.
  - "title": a short caption (max 24 characters) that means something to me: a trip, a team, an event, a favorite band or game.
  - "colors": up to 3 hex colors for the art.
  - Spread them out along the walls. Leave the middle top of the back wall free (my room's name sign is there), and keep them away from the window.
- Lighting (required): "lights": { "mood", "lamps" }.
  - "mood": warm (cozy), cool (calm), day (bright), night (dark and moody), or neon (gamer, dark with colored glow).
  - "lamps" (2 to 4): each is { "kind", "color" } plus a spot.
    - floor (standing lamp), table (lamp on a small side table) or pendant (hangs from the ceiling) need "at": [x, z] on the floor. Put floor and table lamps in empty corners, not on top of objects.
    - string (fairy lights) or strip (LED strip) need "wall": "back" or "left" instead.
  - Use warm yellow like #FFD39A for cozy light, or bright colors for neon. Match the lighting to my personality.

STEP 5. Keep it safe and public.
- The room is public. Do not include grades, school marks, addresses, phone numbers, emails, private details, or anything I haven't said is OK to share.
- Links are optional and must be public pages (my GitHub, website, a project demo).

STEP 6. Reply with the room code: one JSON code block in exactly this shape.

{
  "v": 1,
  "title": "Maya's Studio",
  "bio": "Maya builds solar cars and paints on weekends.",
  "color": "#FF4FA3",
  "links": [{ "label": "GitHub", "url": "https://github.com/maya" }],
  "objects": [
    {
      "name": "Solar car",
      "type": "project",
      "about": "A small car that drives on sunlight. Maya built it with her robotics team.",
      "link": "https://github.com/maya/solar-car",
      "at": [2, 2],
      "turn": 30,
      "parts": [
        { "shape": "box", "size": [1.2, 0.3, 2.2], "pos": [0, 0.45, 0], "rot": [0, 0, 0], "color": "#3FA7FF" },
        { "shape": "box", "size": [1.3, 0.05, 1.4], "pos": [0, 0.65, 0], "rot": [0, 0, 0], "color": "#1B2A4A", "shiny": true },
        { "shape": "ring", "size": [0.5, 0.5, 0.2], "pos": [0.65, 0.25, 0.7], "rot": [0, 90, 0], "color": "#222222" },
        { "shape": "ring", "size": [0.5, 0.5, 0.2], "pos": [-0.65, 0.25, 0.7], "rot": [0, 90, 0], "color": "#222222" },
        { "shape": "ring", "size": [0.5, 0.5, 0.2], "pos": [0.65, 0.25, -0.7], "rot": [0, 90, 0], "color": "#222222" },
        { "shape": "ring", "size": [0.5, 0.5, 0.2], "pos": [-0.65, 0.25, -0.7], "rot": [0, 90, 0], "color": "#222222" },
        { "shape": "sign", "text": "SUN-1", "size": [0.8, 0.2, 0.01], "pos": [0, 1.1, 0], "rot": [0, 0, 0], "color": "#F2C14E" }
      ]
    },
    { "name": "Painting", "type": "interest", "about": "Maya paints landscapes every weekend.", "kit": "art" }
  ],
  "decor": {
    "window": { "wall": "left", "at": -1.5, "view": "ocean" },
    "pictures": [
      { "wall": "back", "at": -3, "y": 3.2, "size": [1.4, 1.1], "style": "photo", "title": "Team race day", "colors": ["#3FA7FF", "#F2C14E", "#8FD3FF"] },
      { "wall": "back", "at": 3, "y": 3.4, "size": [1.2, 1.6], "style": "poster", "title": "Solar Challenge", "colors": ["#1B2A4A", "#F2C14E", "#FF4FA3"] },
      { "wall": "left", "at": 2.8, "y": 3.4, "size": [1, 1.2], "style": "mountains", "title": "Banff", "colors": ["#3DDC84", "#2CC4B3", "#FFE7B8"] }
    ],
    "lights": {
      "mood": "warm",
      "lamps": [
        { "kind": "pendant", "at": [0.5, 1], "color": "#FFD39A" },
        { "kind": "floor", "at": [-4, -4], "color": "#FFD39A" },
        { "kind": "string", "wall": "back", "color": "#FFD39A" }
      ]
    }
  }
}

Rules for the code: at most 10 objects, 60 parts per object, 400 parts total, 5 pictures, 5 lamps. Titles up to 40 characters, bio up to 200. Pick "color" from: #E8402F, #FF8A4C, #F2C14E, #3DDC84, #2CC4B3, #3FA7FF, #9B6BFF, #FF4FA3.

After the code block, tell me in one line: "Copy this code, open Cubby, click Add your room, paste it, then click Add my room."`;
