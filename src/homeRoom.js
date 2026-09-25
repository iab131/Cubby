import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mat, box, cyl, sph, plane, canvasTex, rr, rand, screenMat } from './three-helpers.js';

const IMG = { arise: '/img/arise.jpg', cruxly: '/img/cruxly.jpg', marauder: '/img/marauder.jpg' };

/* The home room: the detailed hand-built one on the centre square. */
export const KIND = {
  race: { label: 'Interest · Racing', color: '#E8402F' },
  shuttle: { label: 'Interest · Badminton', color: '#2CC4B3' },
  build: { label: 'Project', color: '#FF8A4C' },
  about: { label: 'About', color: '#F2C14E' }
};
export const HOT = [
  { id: 'f1', kind: 'race', name: 'F1 show car', title: 'The F1 car',
    body: 'Racing is one of the two big hobbies here, so the middle of the room goes to a half-size F1 show car on a slow turntable. Front wing, halo, sidepods and fat rear tires. Spare tires wait by the desk.',
    stack: 'Interest · Formula 1', t: [2.55, 0.9, 2.45], d: 9.5, dir: [1, 0.75, 1] },
  { id: 'cockpit', kind: 'race', name: 'Desk cockpit', title: 'Desk cockpit',
    body: 'The desk turns into a sim cockpit: bucket seat, wheel clamped to the edge, pedals underneath, and a screen with lap times. The helmet and the trophy sit on the shelf above.',
    stack: 'Interest · Sim racing corner', t: [2.2, 1.7, -3.3], d: 7.5, dir: [0.55, 0.5, 1] },
  { id: 'badminton', kind: 'shuttle', name: 'Badminton wall', title: 'Badminton wall',
    body: 'The other big hobby. Two rackets on the pegboard, a tube of shuttles on the shelf, and one shuttle on the floor that never made it back.',
    stack: 'Interest · Badminton', t: [-4.9, 3.0, 3.5], d: 6.8, dir: [1, 0.25, 0.25] },
  { id: 'climb', kind: 'build', name: 'Cruxly', title: 'Cruxly climbing wall',
    body: 'Snap a photo of a wall like this one and Cruxly finds every hold, rebuilds the wall in 3D, and helps plan the climb. Watch the little robot: it climbs the blue route while the glowing boxes show the holds Cruxly detected, then jumps down onto the mat.',
    stack: 'Next.js · Prisma · YOLO · MiDaS · MuJoCo', link: 'https://cruxxly.vercel.app/', linkLabel: 'Open Cruxly',
    t: [-1.5, 2.7, -4.2], d: 11.5, dir: [0.3, 0.22, 1] },
  { id: 'tv', kind: 'build', name: 'Steria', title: 'Steria on the TV',
    body: 'The TV plays a match the way Steria sees it. Every player and the ball are tracked from broadcast video, then rebuilt as a 3D replay you can watch from any angle.',
    stack: 'Python · YOLO · ByteTrack · TVCalib · Three.js', link: 'https://steria.udulaa.com/', linkLabel: 'Open Steria',
    t: [1.1, 3.5, -4.9], d: 5.8, dir: [0.25, 0.15, 1] },
  { id: 'map', kind: 'build', name: 'Marauder’s Map', title: 'The map rug',
    body: 'The rug is a Marauder’s Map. Footprints show people walking through a building, sensed with WiFi instead of cameras.',
    stack: 'Web · RuView WiFi sensing', t: [-2.3, 0, 2.1], d: 7.5, dir: [0.6, 1.3, 0.8] },
  { id: 'lego', kind: 'build', name: 'ARISE', title: 'ARISE robot',
    body: 'The little robot doing laps is an ARISE build. ARISE lets 200+ students design, code and test LEGO-style robots in a simulator with no parts needed. This room\u2019s owner is the technical co-founder.',
    stack: 'Unity · C# · Firebase · Next.js', link: 'https://arisesim.com', linkLabel: 'Open ARISE',
    t: [-2.3, 0.3, 2.1], d: 5.5, dir: [0.8, 0.9, 1] },
  { id: 'drone', kind: 'build', name: 'Drone', title: 'RedTeamHacks drone',
    body: 'This drone thinks for itself. In the RedTeamHacks sim it reads arrows, counts spheres and picks its own route to the right target.',
    stack: 'ROS 2 · OpenCV · YOLO11 · ProjectAirSim', t: [3.2, 3.2, -3.2], d: 5, dir: [0.4, 0.3, 1] },
  { id: 'tunnel', kind: 'build', name: 'AeroLab', title: 'Desk wind tunnel',
    body: 'A tiny wind tunnel with a rocket inside. AeroLab puts one in your browser so you can watch air flow around a 3D model.',
    stack: 'Next.js · Three.js · React Three Fiber', t: [4.05, 1.75, -4.25], d: 4, dir: [0.3, 0.35, 1] },
  { id: 'laptop', kind: 'build', name: 'Automation', title: 'The automation laptop',
    body: 'If a task repeats, it gets automated here. again learns a chore and runs it with zero AI calls. CTRL records a Windows workflow and replays it. SkillRouter finds the right skills for coding agents.',
    stack: 'again · CTRL · SkillRouter', t: [0.95, 1.75, -3.95], d: 3.4, dir: [0.3, 0.55, 1] },
  { id: 'board', kind: 'build', name: 'Research', title: 'Research whiteboard',
    body: 'Two research projects. One predicts city traffic from road sensors by treating the road network like waves. The other helps AI video models tell longer stories across many shots.',
    stack: 'PyTorch · Graph ML · Video AI', t: [-4.95, 3.2, -1.4], d: 5.8, dir: [1, 0.15, 0.2] },
  { id: 'film', kind: 'build', name: 'The Inside World', title: 'The Inside World',
    body: 'A sci-fi screenplay first written in grade 10: a hollow planet, an artificial sun, and a signal from outside the shell. It is being rewritten as an AI-made short film.',
    stack: 'Story · AI video', t: [-4.95, 3.2, 0.8], d: 4.5, dir: [1, 0.1, 0.15] },
  { id: 'window', kind: 'about', name: 'The view', title: 'Toronto to Waterloo',
    body: 'Toronto outside the window, Waterloo down the road, where this room’s owner studies Computer Science.',
    stack: 'Waterloo CS · Class of 2030',
    t: [3.6, 3.8, -5], d: 7, dir: [0.25, 0.1, 1] }
];
export const HOT_BY_ID = Object.fromEntries(HOT.map(h => [h.id, h]));

/* ---------- textures ---------- */
function woodTex() {
  const r = rand(7);
  return canvasTex(1024, 1024, (x, w, h) => {
    const rows = 12, rh = h / rows;
    for (let i = 0; i < rows; i++) {
      let px = -r() * 300;
      while (px < w) {
        const len = 260 + r() * 260;
        const l = 30 + r() * 8;
        x.fillStyle = `hsl(24, 38%, ${l}%)`;
        x.fillRect(px, i * rh, len, rh);
        x.strokeStyle = 'rgba(40,22,12,.18)'; x.lineWidth = 1;
        for (let k = 0; k < 5; k++) { const yy = i * rh + 6 + r() * (rh - 12); x.beginPath(); x.moveTo(px, yy); x.bezierCurveTo(px + len * .3, yy + r() * 6 - 3, px + len * .6, yy + r() * 6 - 3, px + len, yy); x.stroke(); }
        x.fillStyle = 'rgba(20,10,6,.55)'; x.fillRect(px, i * rh, 2, rh);
        px += len;
      }
      x.fillStyle = 'rgba(20,10,6,.5)'; x.fillRect(0, i * rh, w, 2);
    }
  }).t;
}
function checkerTex(cols) {
  const tt = canvasTex(cols * 16, 32, (x) => {
    for (let i = 0; i < cols; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#F2F2F2'; x.fillRect(i * 16, j * 16, 16, 16); }
  }).t;
  tt.magFilter = THREE.NearestFilter; return tt;
}


export function createHomeRoom(root, fontsReady) {
  const groups = {};
  const animators = [];
  function hotGroup(id, parent = root) {
    const g = new THREE.Group(); g.userData.hot = id; parent.add(g); groups[id] = groups[id] || []; groups[id].push(g); return g;
  }
  const moon = new THREE.PointLight('#8FB8FF', 14, 10, 1.5); moon.position.set(3.6, 3.8, -4.2); root.add(moon);
  const deskLight = new THREE.PointLight('#FFB070', 16, 9, 1.4); deskLight.position.set(1.2, 3.2, -3.4); root.add(deskLight);
  const neonLight = new THREE.PointLight('#FF7A45', 12, 7, 1.6); neonLight.position.set(-4.3, 5.2, 2.4); root.add(neonLight);
  const tvLight = new THREE.PointLight('#4FE0B8', 5, 5, 1.8); tvLight.position.set(1.1, 3.5, -4.3); root.add(tvLight);
  const lampLight = new THREE.PointLight('#FFC58A', 14, 8, 1.4); lampLight.position.set(-4.35, 3.0, 4.35); root.add(lampLight);

  function build(fontsReady) {
    const FONT = fontsReady ? '"Chakra Petch"' : 'system-ui';
    const HAND = fontsReady ? 'Caveat' : 'cursive';
  
    /* room shell */
    const shell = new THREE.Group(); root.add(shell);
    const wall = mat('#D9CBB3', 0.9), wall2 = mat('#CDBDA2', 0.9), cap = mat('#2C2832', 0.8), slabSide = mat('#25222B', 0.8);
    box(10.5, 0.4, 10.5, [slabSide, slabSide, slabSide, slabSide, slabSide, slabSide], -0.05, -0.2, -0.05, shell);
    const wood = woodTex(); wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
    const floor = plane(10.3, 10.3, mat('#ffffff', 0.7, 0, { map: wood }), -0.05, 0.002, -0.05, shell); floor.rotation.x = -Math.PI / 2;
    box(10.6, 6.9, 0.3, [wall, wall, cap, wall, wall, wall], -0.05, 3.05, -5.15, shell);
    box(0.3, 6.9, 10.3, [wall2, wall2, cap, wall2, wall2, wall2], -5.15, 3.05, 0.05, shell);
    const base = mat('#3B3440', 0.7);
    box(10.1, 0.22, 0.06, base, 0.1, 0.11, -4.97, shell);
    box(0.06, 0.22, 10.1, base, -4.97, 0.11, 0.1, shell);
    const chk = checkerTex(40);
    const edgeZ = plane(10.5, 0.4, mat('#fff', 0.6, 0, { map: chk }), -0.05, -0.2, 5.201, shell);
    const edgeX = plane(10.5, 0.4, mat('#fff', 0.6, 0, { map: checkerTex(40) }), 5.201, -0.2, -0.05, shell); edgeX.rotation.y = Math.PI / 2;
  
    /* ---------- F1 car on turntable ---------- */
    const f1 = hotGroup('f1');
    const table = cyl(2.15, 2.2, 0.12, mat('#1C1B21', 0.5, 0.3), 2.55, 0.06, 2.45, f1, 64);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.17, 0.025, 8, 96), new THREE.MeshBasicMaterial({ color: '#E8402F', toneMapped: false }));
    ring.rotation.x = Math.PI / 2; ring.position.set(2.55, 0.1, 2.45); f1.add(ring);
    const spin = new THREE.Group(); spin.position.set(2.55, 0.12, 2.45); spin.rotation.y = 0.75; f1.add(spin);
    const car = new THREE.Group(); spin.add(car);
    const red = mat('#D32E26', 0.35, 0.25), carbon = mat('#23232A', 0.45, 0.35), tyre = mat('#111114', 0.92), rim = mat('#A2A8B0', 0.3, 0.85), white = mat('#EFEFEF', 0.4);
    box(1.3, 0.05, 3.4, carbon, 0, 0.14, -0.1, car);
    const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.27, 1.4, 20), red);
    nose.rotation.x = Math.PI / 2; nose.scale.set(1.25, 1, 0.62); nose.position.set(0, 0.36, 1.25); car.add(nose);
    box(0.74, 0.44, 1.35, red, 0, 0.42, 0.02, car, 0.1);
    box(0.46, 0.08, 0.6, mat('#0E0E12', 0.6), 0, 0.62, 0.12, car, 0.03);
    for (const s of [-1, 1]) {
      box(0.42, 0.36, 1.35, red, s * 0.56, 0.34, -0.28, car, 0.1);
      box(0.3, 0.2, 0.04, mat('#0E0E12', 0.6), s * 0.56, 0.37, 0.4, car);
      box(0.1, 0.06, 0.05, carbon, s * 0.44, 0.72, 0.32, car);
      cyl(0.012, 0.012, 0.16, carbon, s * 0.44, 0.64, 0.32, car, 6);
    }
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.3, 1.45, 20), red);
    eng.rotation.x = -Math.PI / 2; eng.scale.set(1, 1, 1.35); eng.position.set(0, 0.56, -0.95); car.add(eng);
    box(0.26, 0.3, 0.32, red, 0, 0.84, -0.32, car, 0.06);
    box(0.16, 0.12, 0.03, mat('#0E0E12', 0.6), 0, 0.88, -0.15, car);
    box(0.03, 0.3, 0.85, red, 0, 0.86, -1.05, car);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 10, 28, Math.PI), carbon);
    halo.rotation.x = Math.PI / 2; halo.position.set(0, 0.8, -0.02); car.add(halo);
    const strut = box(0.05, 0.3, 0.05, carbon, 0, 0.68, 0.36, car); strut.rotation.x = 0.55;
    // wings
    box(1.78, 0.035, 0.34, carbon, 0, 0.13, 1.98, car);
    const fw2 = box(1.6, 0.03, 0.2, red, 0, 0.2, 1.86, car); fw2.rotation.x = -0.28;
    for (const s of [-1, 1]) box(0.03, 0.2, 0.42, carbon, s * 0.9, 0.2, 1.95, car);
    box(1.12, 0.04, 0.3, carbon, 0, 0.98, -1.78, car);
    const flap = box(1.12, 0.03, 0.2, red, 0, 1.07, -1.7, car); flap.rotation.x = -0.35;
    for (const s of [-1, 1]) box(0.03, 0.58, 0.52, red, s * 0.57, 0.88, -1.74, car);
    box(0.05, 0.4, 0.1, carbon, 0, 0.72, -1.74, car);
    box(0.9, 0.03, 0.15, carbon, 0, 0.5, -1.82, car);
    box(1.0, 0.12, 0.26, carbon, 0, 0.18, -1.76, car);
    // wheels
    const wheel = (x, z, r, w) => {
      const g = new THREE.Group(); g.position.set(x, r, z); car.add(g);
      const t = cyl(r, r, w, tyre, 0, 0, 0, g, 36); t.rotation.z = Math.PI / 2;
      const rm = cyl(r * 0.6, r * 0.6, w + 0.012, rim, 0, 0, 0, g, 28); rm.rotation.z = Math.PI / 2;
      for (const s of [-1, 1]) { const band = new THREE.Mesh(new THREE.TorusGeometry(r * 0.8, 0.012, 6, 40), mat('#F2C14E', 0.5)); band.rotation.y = Math.PI / 2; band.position.x = s * (w / 2 + 0.002); g.add(band); }
      const arm = box(Math.abs(x) - 0.3, 0.025, 0.05, carbon, -Math.sign(x) * (Math.abs(x) - 0.3) / 2 - Math.sign(x) * 0.02, 0.02, 0, g);
      const arm2 = box(Math.abs(x) - 0.3, 0.025, 0.05, carbon, arm.position.x, 0.12, 0.08, g);
      return g;
    };
    const wheels = [wheel(-0.8, 1.25, 0.33, 0.32), wheel(0.8, 1.25, 0.33, 0.32), wheel(-0.83, -1.2, 0.36, 0.42), wheel(0.83, -1.2, 0.36, 0.42)];
    const num = canvasTex(256, 128, (x, w, h) => { x.fillStyle = '#F4F4F4'; rr(x, 8, 8, w - 16, h - 16, 18); x.fill(); x.fillStyle = '#111'; x.font = `700 92px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('01', w / 2, h / 2 + 4); }).t;
    for (const s of [-1, 1]) { const d = plane(0.5, 0.25, mat('#fff', 0.5, 0, { map: num }), s * 0.772, 0.37, -0.35, car); d.rotation.y = s * Math.PI / 2; }
    // tyre stack
    const stack = new THREE.Group(); stack.position.set(4.3, 0, -1.25); f1.add(stack);
    for (let i = 0; i < 3; i++) {
      const tr = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.14, 14, 36), tyre); tr.rotation.x = Math.PI / 2; tr.position.y = 0.14 + i * 0.28; stack.add(tr);
      const bd = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.02, 6, 36), mat(i === 1 ? '#F2C14E' : '#E8402F', 0.5)); bd.rotation.x = Math.PI / 2; bd.position.y = 0.14 + i * 0.28 + 0.13; stack.add(bd);
    }
    animators.push((dt, t) => { spin.rotation.y += dt * 0.12; });
  
    /* ---------- desk + cockpit ---------- */
    const desk = new THREE.Group(); root.add(desk);
    const walnut = mat('#6E4530', 0.55), metal = mat('#1E1D22', 0.5, 0.6);
    box(4.1, 0.1, 1.5, walnut, 2.65, 1.5, -4.2, desk, 0.03);
    for (const [lx, lz] of [[0.72, -4.85], [4.58, -4.85], [0.72, -3.55], [4.58, -3.55]]) box(0.08, 1.45, 0.08, metal, lx, 0.725, lz, desk);
    box(3.8, 0.06, 0.06, metal, 2.65, 0.4, -4.85, desk);
  
    const cockpit = hotGroup('cockpit');
    const blk = mat('#16161B', 0.8), redA = mat('#E8402F', 0.5);
    box(0.7, 0.1, 0.8, metal, 2.2, 0.3, -2.35, cockpit);
    cyl(0.06, 0.06, 0.3, metal, 2.2, 0.45, -2.35, cockpit, 12);
    box(0.82, 0.2, 0.82, blk, 2.2, 0.7, -2.35, cockpit, 0.08);
    const back = box(0.82, 1.3, 0.2, blk, 2.2, 1.38, -1.95, cockpit, 0.08); back.rotation.x = 0.18;
    for (const s of [-1, 1]) { const b = box(0.14, 1.0, 0.34, blk, 2.2 + s * 0.4, 1.3, -2.0, cockpit, 0.05); b.rotation.x = 0.18; const st = box(0.02, 1.0, 0.05, redA, 2.2 + s * 0.47, 1.3, -1.93, cockpit); st.rotation.x = 0.18; }
    box(0.36, 0.22, 0.42, blk, 2.2, 1.66, -3.62, cockpit, 0.04);
    const wheelG = new THREE.Group(); wheelG.position.set(2.2, 1.86, -3.32); wheelG.rotation.x = -0.25; cockpit.add(wheelG);
    wheelG.add(new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.042, 12, 44), blk));
    const hub = cyl(0.1, 0.1, 0.07, carbon, 0, 0, 0, wheelG, 20); hub.rotation.x = Math.PI / 2;
    box(0.5, 0.05, 0.03, carbon, 0, 0, 0, wheelG);
    box(0.05, 0.25, 0.03, carbon, 0, -0.13, 0, wheelG);
    box(0.05, 0.04, 0.09, redA, 0, 0.27, 0, wheelG);
    box(0.75, 0.06, 0.45, metal, 2.2, 0.04, -3.95, cockpit);
    for (const px of [1.96, 2.2, 2.44]) { const p = box(0.13, 0.3, 0.03, carbon, px, 0.22, -3.85, cockpit); p.rotation.x = -0.5; }
    // shelf with helmet + trophy
    box(1.4, 0.07, 0.5, walnut, -0.62, 2.3, -4.75, desk);
    for (const bx of [-1.15, -0.1]) box(0.05, 0.25, 0.4, metal, bx, 2.15, -4.8, desk);
    const helmet = new THREE.Group(); helmet.position.set(-0.95, 2.6, -4.72); helmet.rotation.y = 0.5; cockpit.add(helmet);
    const shellH = sph(0.27, mat('#F3F3F3', 0.3, 0.1), 0, 0, 0, helmet, 32); shellH.scale.set(0.95, 0.92, 1.1);
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.265, 0.03, 8, 40), redA); stripe.rotation.y = Math.PI / 2; stripe.scale.set(1.08, 0.94, 1); helmet.add(stripe);
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.28, 32, 16, Math.PI / 2 - 0.85, 1.7, 1.15, 0.55), mat('#121418', 0.08, 0.7));
    visor.scale.set(0.95, 0.92, 1.1); helmet.add(visor);
    const gold = mat('#E2B34A', 0.28, 0.9);
    box(0.22, 0.1, 0.22, blk, -0.3, 2.39, -4.72, cockpit);
    cyl(0.03, 0.03, 0.18, gold, -0.3, 2.53, -4.72, cockpit, 12);
    cyl(0.13, 0.05, 0.22, gold, -0.3, 2.73, -4.72, cockpit, 24);
    for (const s of [-1, 1]) { const hdl = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 16), gold); hdl.position.set(-0.3 + s * 0.14, 2.74, -4.72); cockpit.add(hdl); }
  
    /* ---------- sim racing screen (part of the cockpit) ---------- */
    const monitor = hotGroup('cockpit');
    const monTex = canvasTex(640, 370, (x, w, h) => {
      x.fillStyle = '#0E1114'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#E8402F'; x.fillRect(0, 0, w, 6);
      x.fillStyle = '#EDEFF3'; x.font = `600 22px ${FONT}`; x.fillText('LAP 12 / 20', 28, 44);
      x.fillStyle = '#8B93A1'; x.font = '16px system-ui'; x.fillText('Best lap', 28, 80);
      x.fillStyle = '#3DDC84'; x.font = `700 40px ${FONT}`; x.fillText('1:21.604', 28, 122);
      x.fillStyle = '#8B93A1'; x.font = '16px system-ui'; x.fillText('Gap to leader', 28, 160);
      x.fillStyle = '#F2C14E'; x.font = `700 28px ${FONT}`; x.fillText('+0.318', 28, 194);
      // track outline
      x.strokeStyle = '#3A414B'; x.lineWidth = 14; x.lineJoin = 'round';
      const trk = [[330, 70], [560, 60], [600, 120], [520, 170], [590, 250], [470, 320], [360, 300], [300, 220], [380, 160], [300, 110]];
      x.beginPath(); trk.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath(); x.stroke();
      x.strokeStyle = '#C9CDD6'; x.lineWidth = 3; x.stroke();
      x.fillStyle = '#E8402F'; x.beginPath(); x.arc(560, 60, 9, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#2CC4B3'; x.beginPath(); x.arc(470, 320, 7, 0, Math.PI * 2); x.fill();
      // speed trace
      x.strokeStyle = '#2CC4B3'; x.lineWidth = 3; x.beginPath();
      for (let i = 0; i <= 250; i += 5) { const y = 330 - (0.5 + 0.5 * Math.sin(i / 18) * Math.cos(i / 41)) * 90; i ? x.lineTo(28 + i, y) : x.moveTo(28, y); }
      x.stroke(); x.fillStyle = '#8B93A1'; x.font = '14px system-ui'; x.fillText('Speed', 28, 232);
    }).t;
    box(1.34, 0.8, 0.06, blk, 1.9, 2.2, -4.62, monitor, 0.02);
    plane(1.28, 0.74, screenMat(monTex), 1.9, 2.2, -4.585, monitor);
    box(0.08, 0.36, 0.08, metal, 1.9, 1.73, -4.66, monitor);
    box(0.42, 0.03, 0.26, metal, 1.9, 1.565, -4.62, monitor);
    // books
    const shelfBooks = new THREE.Group(); root.add(shelfBooks);
    const books = [['#2F6FD6', 0.1], ['#F2C14E', 0.08], ['#E8402F', 0.12], ['#2CC4B3', 0.09]];
    let by = 1.55;
    books.forEach(([c, t], i) => { const b = box(0.5, t, 0.36, mat(c, 0.7), 2.95, by + t / 2, -4.6, shelfBooks); b.rotation.y = (i % 2 ? 0.12 : -0.08); by += t; });
  
    /* ---------- laptop (agents) ---------- */
    const laptop = hotGroup('laptop');
    const lapTex = canvasTex(512, 320, (x, w, h) => {
      x.fillStyle = '#0D1117'; x.fillRect(0, 0, w, h);
      x.font = '17px ui-monospace, Menlo, Consolas, monospace';
      const lines = [['$ again teach weekly-signups', '#E6EDF3'], ['  learned 6 steps, proof passed', '#7EE787'], ['$ again run --all', '#E6EDF3'], ['  14 runs, 0 model calls', '#7EE787'], ['$ ctrl replay invoices.ctrl', '#E6EDF3'], ['  replayed 23 steps', '#7EE787'], ['$ skillrouter recommend .', '#E6EDF3'], ['  3 skills fit this repo', '#79C0FF'], ['$ ', '#E6EDF3']];
      lines.forEach(([t, c], i) => { x.fillStyle = c; x.fillText(t, 22, 36 + i * 32); });
      x.fillStyle = '#E6EDF3'; x.fillRect(46, 36 + 8 * 32 - 15, 10, 19);
    }).t;
    box(0.82, 0.035, 0.56, mat('#B9BEC6', 0.35, 0.7), 0.98, 1.57, -3.95, laptop, 0.015);
    const lid = new THREE.Group(); lid.position.set(0.98, 1.59, -4.23); lid.rotation.x = -0.28; laptop.add(lid);
    box(0.82, 0.54, 0.025, mat('#B9BEC6', 0.35, 0.7), 0, 0.27, 0, lid, 0.012);
    plane(0.76, 0.48, screenMat(lapTex), 0, 0.28, 0.014, lid);
  
    /* ---------- wind tunnel ---------- */
    const tunnel = hotGroup('tunnel');
    const tg = new THREE.Group(); tg.position.set(4.05, 1.86, -4.3); tunnel.add(tg);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.05, 32, 1, true), mat('#CFE8FF', 0.05, 0.1, { transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
    glass.rotation.z = Math.PI / 2; tg.add(glass);
    const streams = canvasTex(128, 512, (x, w, h) => {
      const r = rand(3);
      for (let i = 0; i < 16; i++) { const xx = r() * w; const len = 60 + r() * 140; const y0 = r() * h; const g = x.createLinearGradient(0, y0, 0, y0 + len); g.addColorStop(0, 'rgba(120,220,255,0)'); g.addColorStop(1, 'rgba(160,235,255,.95)'); x.strokeStyle = g; x.lineWidth = 2; x.beginPath(); x.moveTo(xx, y0); x.lineTo(xx, y0 + len); x.stroke(); }
    }).t;
    streams.wrapS = streams.wrapT = THREE.RepeatWrapping;
    const flow = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1.0, 32, 1, true), new THREE.MeshBasicMaterial({ map: streams, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    flow.rotation.z = Math.PI / 2; tg.add(flow);
    const silver = mat('#D8DDE3', 0.2, 0.9);
    const body = cyl(0.055, 0.055, 0.42, silver, 0.02, 0, 0, tg, 20); body.rotation.z = Math.PI / 2;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.17, 20), silver); cone.rotation.z = -Math.PI / 2; cone.position.x = 0.315; tg.add(cone);
    for (let i = 0; i < 3; i++) { const fin = box(0.12, 0.004, 0.08, redA, -0.14, 0, 0, tg); fin.rotation.x = i * Math.PI * 2 / 3; fin.translateZ(0.08); }
    const fan = cyl(0.3, 0.3, 0.1, blk, 0.56, 0, 0, tg, 32); fan.rotation.z = Math.PI / 2;
    const fanRing = cyl(0.3, 0.3, 0.06, metal, -0.55, 0, 0, tg, 32, true); fanRing.rotation.z = Math.PI / 2;
    for (const sx of [-0.35, 0.35]) box(0.06, 0.26, 0.2, metal, sx, -0.21, 0, tg);
    animators.push((dt) => { streams.offset.y -= dt * 0.9; });
  
    /* ---------- drone ---------- */
    const droneG = hotGroup('drone');
    const drone = new THREE.Group(); drone.position.set(3.2, 3.2, -3.2); droneG.add(drone);
    box(0.38, 0.1, 0.38, blk, 0, 0, 0, drone, 0.04);
    box(0.26, 0.05, 0.26, mat('#C9DE3B', 0.5), 0, 0.07, 0, drone, 0.03);
    const props = [];
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + i * Math.PI / 2;
      const arm = box(0.42, 0.035, 0.05, blk, Math.cos(a) * 0.24, 0, Math.sin(a) * 0.24, drone); arm.rotation.y = -a;
      const mx = Math.cos(a) * 0.43, mz = Math.sin(a) * 0.43;
      cyl(0.045, 0.045, 0.08, metal, mx, 0.03, mz, drone, 12);
      const p = box(0.36, 0.008, 0.04, mat('#E8E8E8', 0.5, 0, { transparent: true, opacity: 0.85 }), mx, 0.08, mz, drone); props.push(p);
      sph(0.02, new THREE.MeshBasicMaterial({ color: '#46B8FF', toneMapped: false }), mx, -0.03, mz, drone, 8);
    }
    box(0.08, 0.06, 0.06, metal, 0, -0.06, 0.17, drone);
    animators.push((dt, t) => { drone.position.y = 3.2 + Math.sin(t * 1.4) * 0.12; drone.rotation.y = Math.sin(t * 0.4) * 0.5; drone.rotation.z = Math.sin(t * 1.1) * 0.04; props.forEach(p => { p.rotation.y += dt * 40; }); });
  
    /* ---------- TV (Steria) + soccer ball ---------- */
    const tv = hotGroup('tv');
    const TVW = 640, TVH = 360;
    const tvT = canvasTex(TVW, TVH);
    const players = [];
    const pr = rand(11);
    for (let i = 0; i < 14; i++) players.push({ team: i < 7 ? 0 : 1, bx: 0.15 + pr() * 0.7, by: 0.15 + pr() * 0.7, ax: 0.05 + pr() * 0.08, ay: 0.04 + pr() * 0.08, fx: 0.3 + pr() * 0.6, fy: 0.3 + pr() * 0.6, ph: pr() * 6, trail: [] });
    function drawTV(t) {
      const x = tvT.ctx, w = TVW, h = TVH;
      for (let i = 0; i < 10; i++) { x.fillStyle = i % 2 ? '#2F8F4A' : '#35A054'; x.fillRect(i * w / 10, 0, w / 10, h); }
      x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 2;
      x.strokeRect(20, 18, w - 40, h - 36); x.beginPath(); x.moveTo(w / 2, 18); x.lineTo(w / 2, h - 18); x.stroke();
      x.beginPath(); x.arc(w / 2, h / 2, 46, 0, Math.PI * 2); x.stroke();
      x.strokeRect(20, h / 2 - 70, 70, 140); x.strokeRect(w - 90, h / 2 - 70, 70, 140);
      let ball = null;
      players.forEach((p, i) => {
        const px = 20 + (w - 40) * (p.bx + Math.sin(t * p.fx + p.ph) * p.ax), py = 18 + (h - 36) * (p.by + Math.cos(t * p.fy + p.ph) * p.ay);
        p.trail.push([px, py]); if (p.trail.length > 18) p.trail.shift();
        x.strokeStyle = p.team ? 'rgba(90,170,255,.7)' : 'rgba(255,110,90,.7)'; x.lineWidth = 2; x.beginPath(); p.trail.forEach(([a, b], k) => k ? x.lineTo(a, b) : x.moveTo(a, b)); x.stroke();
        x.fillStyle = p.team ? '#3E8BFF' : '#FF5A4A'; x.beginPath(); x.arc(px, py, 7, 0, Math.PI * 2); x.fill();
        x.strokeStyle = '#fff'; x.lineWidth = 1.5; x.stroke();
        x.fillStyle = 'rgba(255,255,255,.9)'; x.font = '11px ui-monospace, monospace'; x.fillText(String(i + 1), px + 9, py - 8);
        if (i === 3) ball = [px + 12, py + 4];
      });
      if (ball) { x.fillStyle = '#fff'; x.beginPath(); x.arc(ball[0], ball[1], 4.5, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#F2C14E'; x.lineWidth = 1.5; x.beginPath(); x.arc(ball[0], ball[1], 10, 0, Math.PI * 2); x.stroke(); }
      x.fillStyle = 'rgba(10,12,16,.72)'; x.fillRect(w - 176, 26, 150, 26); x.fillStyle = '#fff'; x.font = `600 13px ${FONT}`; x.fillText('STERIA · 3D REPLAY', w - 168, 44);
      tvT.t.needsUpdate = true;
    }
    drawTV(0);
    box(2.0, 1.18, 0.07, blk, 1.1, 3.55, -4.96, tv, 0.02);
    plane(1.92, 1.08, screenMat(tvT.t), 1.1, 3.55, -4.922, tv);
    const ballTex = canvasTex(512, 256, (x, w, h) => {
      x.fillStyle = '#F7F7F7'; x.fillRect(0, 0, w, h); x.fillStyle = '#16161B';
      const pent = (cx, cy, r) => { x.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.9); } x.closePath(); x.fill(); };
      for (let i = 0; i < 5; i++) { pent(i * w / 5 + 50, 70, 26); pent(i * w / 5 + 100, 180, 26); }
      pent(w / 2, 8, 40); pent(w / 2, h - 8, 40);
    }).t;
    const ball = sph(0.27, mat('#fff', 0.5, 0, { map: ballTex }), -0.25, 0.27, 4.35, tv, 32);
    ball.rotation.set(0.4, 0.8, 0.2);
  
    /* ---------- window (about) ---------- */
    const win = hotGroup('window');
    function skyline(isNight) {
      return canvasTex(440, 512, (x, w, h) => {
        const g = x.createLinearGradient(0, 0, 0, h);
        if (isNight) { g.addColorStop(0, '#0A0E2A'); g.addColorStop(0.55, '#26214A'); g.addColorStop(1, '#5B3A58'); }
        else { g.addColorStop(0, '#7DB6F0'); g.addColorStop(0.7, '#CFE4F7'); g.addColorStop(1, '#F1E6D3'); }
        x.fillStyle = g; x.fillRect(0, 0, w, h);
        const r = rand(5);
        if (isNight) { for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.6})`; x.fillRect(r() * w, r() * h * 0.55, 1.6, 1.6); } x.fillStyle = '#F4EBD0'; x.beginPath(); x.arc(340, 90, 22, 0, Math.PI * 2); x.fill(); }
        const bcol = isNight ? '#0D0E1C' : '#8C97AE';
        // CN Tower
        x.fillStyle = bcol; x.beginPath(); x.moveTo(146, h); x.lineTo(160, 150); x.lineTo(168, 150); x.lineTo(182, h); x.fill();
        rr(x, 144, 205, 40, 26, 10); x.fill(); rr(x, 152, 170, 24, 12, 5); x.fill();
        x.fillRect(162, 40, 4, 130);
        if (isNight) { x.fillStyle = '#FF3B3B'; x.fillRect(161, 38, 6, 6); x.fillStyle = 'rgba(255,190,120,.8)'; for (let i = 0; i < 6; i++) x.fillRect(148 + i * 6, 216, 3, 3); }
        for (let i = 0; i < 16; i++) {
          const bw = 26 + r() * 40, bh = 90 + r() * 200, bx = i * 30 - 10 + r() * 10;
          x.fillStyle = bcol; x.fillRect(bx, h - bh, bw, bh);
          if (isNight) for (let yy = h - bh + 8; yy < h - 6; yy += 12) for (let xx = bx + 5; xx < bx + bw - 5; xx += 9) if (r() > 0.62) { x.fillStyle = r() > 0.5 ? 'rgba(255,205,130,.85)' : 'rgba(170,200,255,.7)'; x.fillRect(xx, yy, 4, 5); }
        }
      }).t;
    }
    const skyN = skyline(true), skyD = skyline(false);
    const glassMat = screenMat(skyN);
    plane(1.9, 2.2, glassMat, 3.6, 3.75, -4.985, win);
    const frameM = mat('#ECE6DA', 0.6);
    box(2.06, 0.1, 0.14, frameM, 3.6, 4.9, -4.93, win); box(2.06, 0.1, 0.14, frameM, 3.6, 2.6, -4.93, win);
    box(0.1, 2.4, 0.14, frameM, 2.6, 3.75, -4.93, win); box(0.1, 2.4, 0.14, frameM, 4.6, 3.75, -4.93, win);
    box(0.05, 2.2, 0.06, frameM, 3.6, 3.75, -4.95, win); box(1.9, 0.05, 0.06, frameM, 3.6, 3.9, -4.95, win);
    box(2.2, 0.06, 0.3, frameM, 3.6, 2.52, -4.86, win);
  
    { /* ---------- climbing wall (Cruxly) with a robot climber ---------- */
    const climb = hotGroup('climb');
    const plyTex = (base, seed) => {
      const t = canvasTex(256, 1024, (x, w, h) => {
        x.fillStyle = base; x.fillRect(0, 0, w, h);
        const r = rand(seed);
        x.globalAlpha = 0.08; x.strokeStyle = '#000';
        for (let i = 0; i < 40; i++) { const y = r() * h; x.lineWidth = 1 + r() * 2; x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(w * 0.3, y + r() * 12 - 6, w * 0.7, y + r() * 12 - 6, w, y); x.stroke(); }
        x.globalAlpha = 1; x.fillStyle = 'rgba(0,0,0,.45)';
        for (let i = 12; i < w; i += 24) for (let j = 12; j < h; j += 24) { x.beginPath(); x.arc(i + ((j / 24) % 2 ? 12 : 0) - 6, j, 2.6, 0, Math.PI * 2); x.fill(); }
        x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, 0, w, 3); x.fillRect(0, h - 3, w, 3);
      }).t;
      return t;
    };
    const holdMat = c => mat(c, 0.55, 0, { flatShading: true });
    const H_GEO = {
      jug: (() => { const g = new THREE.SphereGeometry(0.11, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); g.rotateX(Math.PI / 2); g.scale(1.25, 0.8, 0.8); return g; })(),
      crimp: new RoundedBoxGeometry(0.17, 0.05, 0.07, 2, 0.02),
      sloper: (() => { const g = new THREE.SphereGeometry(0.12, 10, 8); g.scale(1.3, 0.75, 0.45); return g; })(),
      pinch: (() => { const g = new THREE.CapsuleGeometry(0.035, 0.16, 4, 8); return g; })(),
      knob: new THREE.DodecahedronGeometry(0.075, 0)
    };
    const addHold = (pg, kind, c, x, y, rot = 0) => { const h = new THREE.Mesh(H_GEO[kind], holdMat(c)); h.position.set(x, y, 0.07); h.rotation.z = rot; pg.add(h); return h; };
    const tape = (pg, x, y) => box(0.12, 0.035, 0.004, mat('#F4F1EA', 0.9), x, y - 0.16, 0.063, pg);
    const PANELS = [
      { cx: -4.3, w: 1.25, tilt: 0, col: '#2B3445' },
      { cx: -3.08, w: 1.2, tilt: 0.3, col: '#D9632E' },
      { cx: -1.92, w: 1.15, tilt: 0, col: '#E6DCC8' }
    ];
    const pgs = PANELS.map((p, i) => {
      const pg = new THREE.Group(); pg.position.set(p.cx, 0, -4.92); pg.rotation.x = p.tilt; climb.add(pg);
      const tex = plyTex(p.col, 30 + i);
      box(p.w, 5.4, 0.12, mat('#fff', 0.85, 0, { map: tex }), 0, 2.7, 0, pg);
      return pg;
    });
    // overhang cheeks + top kicker so the middle panel looks built, not floating
    {
      const P = PANELS[1], H = 5.4, dz = Math.sin(P.tilt) * H, dy = Math.cos(P.tilt) * H;
      const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(0, dy); shape.lineTo(dz, dy); shape.lineTo(0, 0);
      const cheekGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false });
      const cheekMat = mat('#8A5A3A', 0.8);
      for (const s of [-1, 1]) { const c = new THREE.Mesh(cheekGeo, cheekMat); c.rotation.y = -Math.PI / 2; c.position.set(P.cx + s * (P.w / 2) + (s < 0 ? 0.05 : 0), 0, -4.92); climb.add(c); }
      box(P.w, 0.1, dz + 0.1, mat('#6E4530', 0.8), P.cx, dy + 0.05, -4.92 + dz / 2, climb);
      const sign = canvasTex(512, 96, (x, w, h) => { x.fillStyle = '#16151B'; x.fillRect(0, 0, w, h); x.fillStyle = '#3DFFB0'; x.font = `700 58px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = '#3DFFB0'; x.shadowBlur = 16; x.fillText('CRUXLY', w / 2, h / 2 + 2); }).t;
      const sp = plane(1.1, 0.2, screenMat(sign), P.cx, dy + 0.05, -4.92 + dz + 0.11, climb);
    }
    // routes: each colour is one climb, start holds marked with tape
    const hr = rand(21);
    const kinds = ['jug', 'crimp', 'sloper', 'pinch', 'knob'];
    const route = (pg, c, xs, y0, y1, n, seed) => {
      const r = rand(seed);
      for (let i = 0; i < n; i++) {
        const y = y0 + (y1 - y0) * i / (n - 1), x = xs + (i % 2 ? 0.22 : -0.22) + (r() - 0.5) * 0.15;
        addHold(pg, i === n - 1 ? 'jug' : kinds[Math.floor(r() * kinds.length)], c, x, y, r() * 3);
        if (i === 0) tape(pg, x, y);
      }
    };
    route(pgs[0], '#FF4FA3', -0.2, 0.5, 5.0, 9, 3); route(pgs[0], '#FFD23F', 0.25, 0.6, 4.8, 8, 4);
    route(pgs[1], '#54D17A', -0.22, 0.6, 5.0, 8, 5); route(pgs[1], '#9B6BFF', 0.25, 0.5, 4.9, 9, 6);
    for (let i = 0; i < 6; i++) addHold(pgs[2], 'knob', ['#FF8A4C', '#FFD23F', '#FF4FA3'][i % 3], (hr() - 0.5) * 0.9, 0.5 + hr() * 4.4, hr() * 3);
    // volumes
    const volWood = mat('#C9A27A', 0.7, 0, { flatShading: true });
    const v1 = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.36, 4), volWood); v1.rotation.set(Math.PI / 2, Math.PI / 4, 0); v1.position.set(0.1, 2.6, 0.24); pgs[0].add(v1);
    const v2 = new THREE.Mesh(new THREE.TetrahedronGeometry(0.34), mat('#2CC4B3', 0.7, 0, { flatShading: true })); v2.position.set(-0.15, 3.3, 0.15); v2.rotation.set(0.6, 0.8, 0); pgs[1].add(v2);
    // the robot's route (blue) on the right panel, with glowing "detected hold" boxes like the app draws
    const RC = pgs[2];
    const ROUTE = [[-0.24, 0.45], [0.24, 0.7], [-0.2, 1.3], [0.24, 1.7], [-0.28, 2.2], [0.2, 2.6], [-0.2, 3.1], [0.26, 3.5], [-0.24, 4.0], [0.2, 4.4], [0, 4.95]];
    const detMat = [];
    ROUTE.forEach(([x, y], i) => {
      addHold(RC, i === ROUTE.length - 1 ? 'jug' : (i % 3 === 1 ? 'crimp' : 'jug'), '#3FA7FF', x, y, i * 0.7);
      if (i < 2) tape(RC, x, y);
      const m = new THREE.LineBasicMaterial({ color: '#3DFFB0', transparent: true, opacity: 0, depthWrite: false });
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(0.3, 0.24)), m); e.position.set(x, y, 0.16); RC.add(e); detMat.push(m);
    });
    // crash mats, chalk bucket
    box(1.75, 0.4, 1.9, mat('#343A48', 0.9), -4.02, 0.2, -3.9, climb, 0.1);
    box(1.75, 0.4, 1.9, mat('#3A4150', 0.9), -2.26, 0.2, -3.9, climb, 0.1);
    box(3.52, 0.02, 0.2, mat('#E8402F', 0.8), -3.14, 0.405, -3.05, climb);
    cyl(0.1, 0.12, 0.2, mat('#2CC4B3', 0.8), -1.55, 0.5, -3.3, climb, 16);
    cyl(0.085, 0.085, 0.02, mat('#F4F1EA', 1), -1.55, 0.61, -3.3, climb, 16);

    // ---- the robot climber (2-bone IK arms and legs) ----
    const bot = new THREE.Group(); RC.add(bot);
    const bWhite = mat('#EDEDEA', 0.4, 0.1), bDark = mat('#2A2B31', 0.5, 0.4), bOrange = mat('#FF8A4C', 0.5), bGlow = new THREE.MeshBasicMaterial({ color: '#3DFFB0', toneMapped: false });
    const torso = box(0.32, 0.4, 0.2, bWhite, 0, 0, 0, bot, 0.06);
    box(0.1, 0.05, 0.01, bGlow, 0, 0.08, -0.105, torso);
    box(0.2, 0.14, 0.05, bOrange, 0, -0.02, 0.1, torso, 0.02);
    const pelvis = box(0.26, 0.1, 0.16, bDark, 0, -0.27, 0, bot, 0.03);
    const head = sph(0.12, bWhite, 0, 0.33, 0, bot, 20);
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.122, 20, 10, Math.PI * 0.5 + 0.9, Math.PI - 1.8 + 1.2, 1.2, 0.6), bGlow); visor.rotation.y = Math.PI; head.add(visor);
    const segGeo = new THREE.CylinderGeometry(0.035, 0.03, 1, 10);
    const seg = m => { const s = new THREE.Mesh(segGeo, m); bot.add(s); return s; };
    const joint = r => sph(r, bOrange, 0, 0, 0, bot, 10);
    const limb = (side, isArm) => ({ side, isArm, a: seg(bDark), b: seg(isArm ? bWhite : bDark), j: joint(0.045), end: isArm ? sph(0.05, bDark, 0, 0, 0, bot, 10) : box(0.08, 0.05, 0.14, bDark, 0, 0, 0, bot, 0.02), l1: isArm ? 0.34 : 0.4, l2: isArm ? 0.32 : 0.4 });
    const LIMBS = { lh: limb(-1, true), rh: limb(1, true), lf: limb(-1, false), rf: limb(1, false) };
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const UP = V(0, 1, 0);
    function place(mesh, a, b) { const d = b.clone().sub(a); const L = d.length(); mesh.position.copy(a).addScaledVector(d, 0.5); mesh.quaternion.setFromUnitVectors(UP, d.normalize()); mesh.scale.set(1, L, 1); }
    function solve(L, root, target, pole) {
      const d = target.clone().sub(root); let len = d.length(); const reach = (L.l1 + L.l2) * 0.999;
      const dir = d.clone().normalize(); if (len > reach) len = reach;
      const a = (L.l1 * L.l1 - L.l2 * L.l2 + len * len) / (2 * len); const h = Math.sqrt(Math.max(0, L.l1 * L.l1 - a * a));
      const p = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
      const mid = root.clone().addScaledVector(dir, a).addScaledVector(p, h);
      const tip = root.clone().addScaledVector(dir, len);
      place(L.a, root, mid); place(L.b, mid, tip); L.j.position.copy(mid); L.end.position.copy(tip);
    }
    // climbing state (panel-local: x across, y up, z out of the wall)
    const HAND_Z = 0.12, FOOT_Z = 0.14;
    const pt = (i, z) => V(ROUTE[i][0], ROUTE[i][1], z);
    let tgt, plan, step, phase, mode, fallV, fallOff, rest;
    function resetClimb() {
      tgt = { lf: pt(0, FOOT_Z), rf: pt(1, FOOT_Z), lh: pt(2, HAND_Z), rh: pt(3, HAND_Z) };
      plan = [];
      const last = { l: 0, r: 1 };
      for (let i = 4; i < ROUTE.length - 1; i++) {
        const s = ROUTE[i][0] < 0 ? 'l' : 'r';
        plan.push({ limb: s + 'h', to: pt(i, HAND_Z) });
        const fi = i - 4; if (fi > last[s]) { plan.push({ limb: s + 'f', to: pt(fi, FOOT_Z) }); last[s] = fi; }
      }
      const top = ROUTE.length - 1;
      plan.push({ limb: 'lh', to: V(ROUTE[top][0] - 0.08, ROUTE[top][1], HAND_Z) });
      plan.push({ limb: 'rh', to: V(ROUTE[top][0] + 0.08, ROUTE[top][1], HAND_Z) });
      step = 0; phase = 0; mode = 'climb'; fallV = 0; fallOff = V(0, 0, 0); rest = 0; bot.rotation.set(0, 0, 0); bot.scale.setScalar(1);
    }
    resetClimb();
    let moving = null;
    const MOVE_T = 0.7;
    function pose() {
      const T = {}; for (const k in tgt) T[k] = tgt[k].clone();
      if (moving) { const k = Math.min(1, phase / MOVE_T), e = k * k * (3 - 2 * k); T[moving.limb] = moving.from.clone().lerp(moving.to, e); T[moving.limb].z += Math.sin(Math.PI * k) * 0.22; }
      const hands = T.lh.clone().add(T.rh).multiplyScalar(0.5), feet = T.lf.clone().add(T.rf).multiplyScalar(0.5);
      const cx = (hands.x + feet.x) / 2, cy = Math.min(hands.y - 0.42, (hands.y + feet.y) / 2 + 0.12);
      const body = V(cx, cy, 0.42).add(fallOff);
      for (const k in T) T[k].add(fallOff);
      torso.position.copy(body); pelvis.position.copy(body).add(V(0, -0.27, 0.02)); head.position.copy(body).add(V(0, 0.33, 0.04));
      const lean = THREE.MathUtils.clamp((hands.x - feet.x) * 0.6, -0.3, 0.3); torso.rotation.z = -lean; pelvis.rotation.z = -lean * 0.5;
      const sh = s => body.clone().add(V(s * 0.19, 0.15, 0)), hip = s => body.clone().add(V(s * 0.1, -0.3, 0));
      solve(LIMBS.lh, sh(-1), T.lh, V(-0.7, -0.4, 0.6)); solve(LIMBS.rh, sh(1), T.rh, V(0.7, -0.4, 0.6));
      solve(LIMBS.lf, hip(-1), T.lf, V(-0.8, 0.3, 0.6)); solve(LIMBS.rf, hip(1), T.rf, V(0.8, 0.3, 0.6));
    }
    pose();
    let scan = 0;
    animators.push(dt => {
      scan += dt;
      detMat.forEach((m, i) => { const t = (scan * 1.3 - i * 0.35) % 8; m.opacity = t > 0 && t < 3 ? Math.min(1, t * 3) * (1 - t / 3) + 0.15 : 0.12; });
      if (mode === 'climb') {
        if (!moving) {
          if (step >= plan.length) { mode = 'top'; rest = 0; }
          else { const p = plan[step]; moving = { limb: p.limb, from: tgt[p.limb].clone(), to: p.to.clone() }; phase = 0; }
        } else {
          phase += dt;
          if (phase >= MOVE_T + 0.18) { tgt[moving.limb] = moving.to.clone(); moving = null; step++; }
        }
      } else if (mode === 'top') {
        rest += dt; if (rest > 1.4) { mode = 'fall'; fallV = 0; }
      } else if (mode === 'fall') {
        fallV += 9.8 * dt; fallOff.y -= fallV * dt; fallOff.z = Math.min(0.95, fallOff.z + dt * 1.6);
        const lowest = Math.min(tgt.lf.y, tgt.rf.y) + fallOff.y;
        if (lowest <= 0.47) { fallOff.y += 0.47 - lowest; mode = 'land'; rest = 0; }
      } else if (mode === 'land') {
        rest += dt; bot.scale.setScalar(rest > 1.6 ? Math.max(0.01, 1 - (rest - 1.6) * 3) : 1);
        if (rest > 2) { resetClimb(); }
      }
      pose();
    });
    }

    /* ---------- left wall: whiteboard, frames, poster, pegboard, neon ---------- */
    const boardG = hotGroup('board');
    const wb = canvasTex(900, 560, (x, w, h) => {
      x.fillStyle = '#F7F7F2'; x.fillRect(0, 0, w, h);
      x.lineCap = 'round';
      x.fillStyle = '#1C3D8F'; x.font = `600 40px ${HAND}`; x.fillText('traffic = waves on a graph', 40, 62);
      const nodes = [[90, 170], [170, 120], [240, 190], [150, 250], [300, 130], [320, 240], [220, 300]];
      x.strokeStyle = '#1C3D8F'; x.lineWidth = 3;
      [[0, 1], [1, 2], [0, 3], [2, 3], [1, 4], [2, 5], [4, 5], [3, 6], [5, 6]].forEach(([a, b]) => { x.beginPath(); x.moveTo(...nodes[a]); x.lineTo(...nodes[b]); x.stroke(); });
      nodes.forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 11, 0, Math.PI * 2); x.fillStyle = '#F7F7F2'; x.fill(); x.stroke(); });
      const wave = (col, amp, f, yo) => { x.strokeStyle = col; x.lineWidth = 4; x.beginPath(); for (let i = 0; i <= 380; i += 4) { const yy = yo + Math.sin(i / 380 * Math.PI * f) * amp; i ? x.lineTo(430 + i, yy) : x.moveTo(430 + i, yy); } x.stroke(); };
      wave('#D6302A', 30, 2, 150); wave('#1E8F5A', 22, 5, 200); wave('#1C3D8F', 14, 9, 245);
      x.fillStyle = '#333'; x.font = `600 30px ${HAND}`; x.fillText('eigenmodes  →  learn over time × modes', 430, 310);
      x.fillStyle = '#D6302A'; x.font = `600 44px ${HAND}`; x.fillText('MAE  3.339 → 3.283', 60, 400);
      x.strokeStyle = '#D6302A'; x.lineWidth = 3; x.beginPath(); x.ellipse(215, 388, 190, 40, -0.03, 0, Math.PI * 2); x.stroke();
      x.fillStyle = '#1E8F5A'; x.font = `600 34px ${HAND}`; x.fillText('long video: keep the story across shots', 430, 390);
      x.strokeStyle = '#333'; x.lineWidth = 3;
      for (let i = 0; i < 4; i++) { x.strokeRect(440 + i * 105, 420, 90, 64); x.fillStyle = '#333'; x.font = `600 24px ${HAND}`; x.fillText('shot ' + (i + 1), 452 + i * 105, 460); }
      x.fillStyle = '#555'; x.font = `600 28px ${HAND}`; x.fillText('207 sensors', 60, 500);
    }).t;
    box(0.06, 1.62, 2.52, mat('#B9BDC4', 0.4, 0.7), -4.97, 3.2, -1.4, boardG);
    const wbp = plane(2.44, 1.54, mat('#fff', 0.35, 0, { map: wb }), -4.935, 3.2, -1.4, boardG); wbp.rotation.y = Math.PI / 2;
    box(0.14, 0.04, 1.2, mat('#B9BDC4', 0.4, 0.7), -4.9, 2.37, -1.4, boardG);
    [['#D6302A', -1.7], ['#1C3D8F', -1.55], ['#1E8F5A', -1.4]].forEach(([c, z]) => { const m = cyl(0.018, 0.018, 0.16, mat(c, 0.5), -4.88, 2.41, z, boardG, 8); m.rotation.x = Math.PI / 2; });
  
    const loader = new THREE.TextureLoader();
    const frameOf = (id, src, z) => {
      const g = hotGroup(id);
      box(0.05, 0.58, 0.76, mat('#1B1A20', 0.6), -4.97, 4.55, z, g);
      const m = mat('#888', 0.6);
      const p = plane(0.68, 0.5, m, -4.94, 4.55, z, g); p.rotation.y = Math.PI / 2;
      loader.load(src, tex => {
        tex.colorSpace = THREE.SRGBColorSpace;
        const ia = tex.image.width / tex.image.height, a = 0.68 / 0.5;
        if (ia > a) { tex.repeat.set(a / ia, 1); tex.offset.set((1 - a / ia) / 2, 0); } else { tex.repeat.set(1, ia / a); tex.offset.set(0, (1 - ia / a) / 2); }
        const cur = p.material; cur.map = tex; cur.color.set('#ffffff'); cur.needsUpdate = true;
      });
    };
    frameOf('lego', IMG.arise, -2.25);
    frameOf('climb', IMG.cruxly, -1.4);
    frameOf('map', IMG.marauder, -0.55);
  
    const film = hotGroup('film');
    const poster = canvasTex(420, 600, (x, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#07091A'); g.addColorStop(1, '#1D1433'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      const cx = w / 2, cy = 250;
      x.strokeStyle = 'rgba(255,190,120,.35)'; x.lineWidth = 26; x.beginPath(); x.arc(cx, cy, 150, 0, Math.PI * 2); x.stroke();
      const r = rand(9); for (let i = 0; i < 220; i++) { const a = r() * Math.PI * 2, rd = 138 + r() * 24; x.fillStyle = `rgba(255,${180 + r() * 60},120,${0.4 + r() * 0.6})`; x.fillRect(cx + Math.cos(a) * rd, cy + Math.sin(a) * rd, 2, 2); }
      const sun = x.createRadialGradient(cx, cy, 0, cx, cy, 70); sun.addColorStop(0, '#FFF2C4'); sun.addColorStop(0.35, '#FFB050'); sun.addColorStop(1, 'rgba(255,120,40,0)'); x.fillStyle = sun; x.beginPath(); x.arc(cx, cy, 70, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#05060F'; x.beginPath(); x.moveTo(0, 470); x.lineTo(150, 400); x.lineTo(230, 430); x.lineTo(300, 380); x.lineTo(w, 450); x.lineTo(w, h); x.lineTo(0, h); x.fill();
      x.fillRect(296, 360, 4, 22); x.beginPath(); x.arc(298, 356, 4, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#F4EDE0'; x.textAlign = 'center'; x.font = `700 44px ${FONT}`; x.fillText('THE INSIDE', cx, 520); x.fillText('WORLD', cx, 562);
      x.fillStyle = '#FFB050'; x.font = `500 15px ${FONT}`; x.fillText('THE SKY IS A MYTH', cx, 70);
    }).t;
    box(0.05, 1.56, 1.1, mat('#0F0E13', 0.6), -4.97, 3.2, 0.85, film);
    const pp = plane(1.0, 1.43, screenMat(poster), -4.94, 3.2, 0.85, film); pp.rotation.y = Math.PI / 2;
    // clapperboard on the shelf
    box(0.3, 0.22, 0.03, mat('#15151A', 0.6), -0.62, 2.45, -4.6, film);
    const clapTop = box(0.3, 0.05, 0.035, mat('#F2F2F2', 0.6), -0.62, 2.6, -4.6, film); clapTop.rotation.z = 0.25;
  
    const bad = hotGroup('badminton');
    const peg = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#DCC6A0'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(60,40,20,.55)'; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.beginPath(); x.arc(16 + i * 32, 16 + j * 32, 3.5, 0, Math.PI * 2); x.fill(); } }).t;
    peg.wrapS = peg.wrapT = THREE.RepeatWrapping; peg.repeat.set(3, 3.5);
    box(0.05, 2.4, 2.0, mat('#DCC6A0', 0.85), -4.97, 3.0, 3.55, bad);
    const pgp = plane(1.98, 2.38, mat('#fff', 0.85, 0, { map: peg }), -4.943, 3.0, 3.55, bad); pgp.rotation.y = Math.PI / 2;
    const strings = canvasTex(128, 160, (x, w, h) => { x.strokeStyle = 'rgba(245,245,245,.9)'; x.lineWidth = 1.5; for (let i = 6; i < w; i += 9) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); } for (let j = 6; j < h; j += 9) { x.beginPath(); x.moveTo(0, j); x.lineTo(w, j); x.stroke(); } }).t;
    const racket = (color, tilt, z) => {
      const outer = new THREE.Group(); outer.position.set(-4.88, 3.05, z); outer.rotation.y = Math.PI / 2; bad.add(outer);
      const r = new THREE.Group(); r.rotation.z = tilt; outer.add(r);
      const frame = mat(color, 0.35, 0.3);
      const head = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.016, 8, 40), frame); head.scale.set(1, 1.28, 1); head.position.y = 0.42; r.add(head);
      const str = new THREE.Mesh(new THREE.CircleGeometry(0.195, 32), new THREE.MeshStandardMaterial({ map: strings, transparent: true, alphaTest: 0.2, side: THREE.DoubleSide, roughness: 0.6 }));
      str.scale.set(1, 1.28, 1); str.position.y = 0.42; r.add(str);
      cyl(0.011, 0.011, 0.36, mat('#2A2A30', 0.4, 0.6), 0, 0.0, 0, r, 8).position.y = 0.0;
      cyl(0.034, 0.03, 0.4, mat('#F4F1EA', 0.8), 0, -0.36, 0, r, 12);
      cyl(0.036, 0.036, 0.03, frame, 0, -0.56, 0, r, 12);
    };
    racket('#E8402F', 0.42, 3.3);
    racket('#2CC4B3', -0.42, 3.8);
    box(0.22, 0.04, 1.2, walnut, -4.86, 2.05, 3.55, bad);
    const tube = cyl(0.085, 0.085, 0.86, mat('#1E7F74', 0.5), -4.84, 2.16, 3.55, bad, 20); tube.rotation.x = Math.PI / 2;
    cyl(0.088, 0.088, 0.08, mat('#F2F2F2', 0.5), -4.84, 2.16, 3.97, bad, 20).rotation.x = Math.PI / 2;
    const shuttle = (x0, y0, z0, rx, rz) => {
      const s = new THREE.Group(); s.position.set(x0, y0, z0); s.rotation.set(rx, 0, rz); bad.add(s);
      const cork = sph(0.05, mat('#F4F0E6', 0.8), 0, 0, 0, s, 16); cork.scale.set(1, 0.8, 1);
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.04, 0.16, 16, 1, true), mat('#FFFFFF', 0.7, 0, { side: THREE.DoubleSide, transparent: true, opacity: 0.92 }));
      skirt.position.y = 0.1; s.add(skirt);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.043, 0.008, 6, 16), mat('#E8402F', 0.6)); band.rotation.x = Math.PI / 2; band.position.y = 0.03; s.add(band);
    };
    shuttle(-3.7, 0.08, 4.35, 0, 1.25);
    shuttle(-4.83, 2.13, 3.05, 0, 0);
  
    const neon = canvasTex(1024, 300, (x, w, h) => {
      x.clearRect(0, 0, w, h);
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = `700 170px ${FONT}`;
      x.shadowColor = '#FF6A2E'; x.shadowBlur = 40; x.fillStyle = '#FFB38A'; x.fillText('ROOM 00', w / 2, 130);
      x.shadowBlur = 12; x.fillStyle = '#FFE7D6'; x.fillText('ROOM 00', w / 2, 130);
      x.font = `600 40px ${FONT}`; x.shadowColor = '#2CC4B3'; x.shadowBlur = 22; x.fillStyle = '#BFF6EF'; x.fillText('RACING · BADMINTON · BUILDING', w / 2, 255);
    }).t;
    const np = plane(3.0, 0.88, new THREE.MeshBasicMaterial({ map: neon, transparent: true, toneMapped: false, depthWrite: false }), -4.93, 5.35, 2.4, root); np.rotation.y = Math.PI / 2;
  
    /* ---------- rug (Marauder's Map) + ARISE robot ---------- */
    const mapG = hotGroup('map');
    const RW = 1024, RH = 800;
    const rugBase = document.createElement('canvas'); rugBase.width = RW; rugBase.height = RH;
    {
      const x = rugBase.getContext('2d'); const r = rand(13);
      x.fillStyle = '#E8D5AE'; x.fillRect(0, 0, RW, RH);
      for (let i = 0; i < 60; i++) { const gx = r() * RW, gy = r() * RH, gr = 40 + r() * 140; const g = x.createRadialGradient(gx, gy, 0, gx, gy, gr); g.addColorStop(0, 'rgba(140,95,50,.10)'); g.addColorStop(1, 'rgba(140,95,50,0)'); x.fillStyle = g; x.fillRect(gx - gr, gy - gr, gr * 2, gr * 2); }
      x.strokeStyle = '#6A4526'; x.lineWidth = 6; x.strokeRect(22, 22, RW - 44, RH - 44); x.lineWidth = 2; x.strokeRect(38, 38, RW - 76, RH - 76);
      x.lineWidth = 4;
      const rooms = [[80, 90, 300, 220, 'Workshop'], [420, 90, 240, 160, 'Library'], [700, 90, 240, 280, 'Tower'], [80, 360, 220, 320, 'Courtyard'], [340, 470, 330, 210, 'Great Hall'], [710, 420, 230, 260, 'Garage']];
      rooms.forEach(([a, b, c, d, n]) => { x.strokeRect(a, b, c, d); x.fillStyle = '#5B3B22'; x.font = `600 34px ${HAND}`; x.textAlign = 'center'; x.fillText(n, a + c / 2, b + d / 2 + 10); });
      x.setLineDash([10, 8]); x.lineWidth = 2; x.beginPath(); x.moveTo(380, 330); x.lineTo(690, 330); x.moveTo(320, 420); x.lineTo(320, 690); x.stroke(); x.setLineDash([]);
      x.fillStyle = '#6A4526'; x.font = `600 40px ${HAND}`; x.textAlign = 'center'; x.fillText('here be footprints', RW / 2, 400);
    }
    const rugT = canvasTex(RW, RH);
    const pathPts = (pts) => { const out = []; for (let i = 0; i < pts.length; i++) { const [a, b] = pts[i], [c, d] = pts[(i + 1) % pts.length]; const L = Math.hypot(c - a, d - b); for (let s = 0; s < L; s += 26) out.push([a + (c - a) * s / L, b + (d - b) * s / L, Math.atan2(d - b, c - a)]); } return out; };
    const walkers = [
      { name: 'Racer', pts: pathPts([[200, 250], [520, 170], [820, 260], [820, 540], [520, 590], [180, 520]]), i: 0 },
      { name: 'Kexin', pts: pathPts([[540, 560], [800, 500], [560, 200], [260, 200], [200, 600]]), i: 20 }
    ];
    function drawRug() {
      const x = rugT.ctx; x.drawImage(rugBase, 0, 0);
      walkers.forEach(wk => {
        const N = 14;
        for (let k = N; k >= 0; k--) {
          const idx = (wk.i - k + wk.pts.length * 10) % wk.pts.length; const [px, py, a] = wk.pts[idx];
          const side = (wk.i - k) % 2 ? 1 : -1; const ox = Math.cos(a + Math.PI / 2) * 9 * side, oy = Math.sin(a + Math.PI / 2) * 9 * side;
          x.save(); x.translate(px + ox, py + oy); x.rotate(a); x.globalAlpha = 1 - k / (N + 1);
          x.fillStyle = '#4A2C16'; x.beginPath(); x.ellipse(0, 0, 11, 6, 0, 0, Math.PI * 2); x.fill(); x.beginPath(); x.ellipse(-13, 0, 5, 4.5, 0, 0, Math.PI * 2); x.fill();
          x.restore();
        }
        const [hx, hy] = wk.pts[wk.i % wk.pts.length];
        x.globalAlpha = 1; x.fillStyle = '#E8D5AE'; x.font = `600 30px ${HAND}`; x.textAlign = 'left';
        const tw = x.measureText(wk.name).width; x.fillRect(hx + 16, hy - 44, tw + 16, 34); x.strokeStyle = '#4A2C16'; x.lineWidth = 2; x.strokeRect(hx + 16, hy - 44, tw + 16, 34);
        x.fillStyle = '#4A2C16'; x.fillText(wk.name, hx + 24, hy - 18);
      });
      rugT.t.needsUpdate = true;
    }
    drawRug();
    box(3.64, 0.03, 2.84, mat('#8A6A45', 0.9), -2.3, 0.015, 2.1, mapG);
    const rug = plane(3.6, 2.8, mat('#fff', 0.95, 0, { map: rugT.t }), -2.3, 0.032, 2.1, mapG); rug.rotation.x = -Math.PI / 2;
    let stepAcc = 0;
    animators.push((dt) => { stepAcc += dt; if (stepAcc > 0.22) { stepAcc = 0; walkers.forEach(w => w.i = (w.i + 1) % w.pts.length); drawRug(); } });
  
    const legoG = hotGroup('lego');
    const bot = new THREE.Group(); bot.scale.setScalar(1.35); legoG.add(bot);
    const yel = mat('#F2C230', 0.45), blu = mat('#2F6FD6', 0.45), wht = mat('#F3F3F3', 0.5);
    box(0.62, 0.12, 0.36, yel, 0, 0.16, 0, bot);
    box(0.36, 0.14, 0.3, blu, -0.06, 0.29, 0, bot);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) cyl(0.03, 0.03, 0.03, blu, -0.18 + i * 0.12, 0.375, -0.07 + j * 0.14, bot, 12);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) cyl(0.03, 0.03, 0.03, yel, 0.2 + i * 0.1, 0.235, -0.07 + j * 0.14, bot, 12);
    box(0.08, 0.1, 0.24, wht, 0.33, 0.2, 0, bot);
    for (const s of [-1, 1]) { const e = cyl(0.035, 0.035, 0.03, mat('#15151A', 0.4), 0.375, 0.2, s * 0.06, bot, 16); e.rotation.z = Math.PI / 2; }
    const botWheels = [];
    for (const [wx, wz] of [[-0.2, -0.21], [-0.2, 0.21], [0.2, -0.21], [0.2, 0.21]]) { const wl = cyl(0.1, 0.1, 0.07, mat('#17171B', 0.9), wx, 0.1, wz, bot, 20); wl.rotation.x = Math.PI / 2; botWheels.push(wl); }
    let ang = 0;
    const placeBot = () => { bot.position.set(-2.3 + Math.cos(ang) * 0.95, 0.03, 2.1 + Math.sin(ang) * 0.95); bot.rotation.y = -ang - Math.PI / 2; };
    placeBot();
    animators.push((dt) => { ang += dt * 0.55; placeBot(); botWheels.forEach(w => w.rotation.y += dt * 6); });
  
    /* ---------- floor lamp ---------- */
    const lamp = new THREE.Group(); root.add(lamp);
    cyl(0.28, 0.3, 0.05, metal, -4.35, 0.025, 4.35, lamp, 24);
    cyl(0.025, 0.025, 2.8, metal, -4.35, 1.42, 4.35, lamp, 10);
    const shade = cyl(0.28, 0.4, 0.45, mat('#F3E4C8', 0.8, 0, { emissive: '#FFC58A', emissiveIntensity: 0.9, side: THREE.DoubleSide }), -4.35, 3.0, 4.35, lamp, 28, true);
    lamp.userData.shade = shade;
  
    /* give every clickable object its own materials so hover glow stays on that object */
    Object.values(groups).forEach(list => {
      const cache = new Map();
      const cl = m => { if (!m.emissive) return m; if (!cache.has(m)) cache.set(m, m.clone()); return cache.get(m); };
      list.forEach(g => g.traverse(o => { if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(cl) : cl(o.material); }));
    });
  
    /* shadows */
    root.traverse(o => { if (o.isMesh) { const basic = o.material && o.material.isMeshBasicMaterial; o.castShadow = !basic; o.receiveShadow = true; } });
    floor.castShadow = false; rug.castShadow = false;
  
    return { drawTV, glassMat, skyN, skyD, shade };
  }

  const built = build(fontsReady);
  return { groups, animators, ...built };
}
