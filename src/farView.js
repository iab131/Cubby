import * as THREE from 'three';
import { lightTextures } from './decor.js';
import { neonSign } from './kit.js';

/* The far version of a room: a handful of draw calls instead of hundreds.
   bakeRoom() turns a fully built room into plain data: every solid piece merged into one mesh with its colour
   painted on the corners (lit pieces in one, glowing/unlit ones in another), with round shapes simplified,
   plus a list of the lamp glows and the name sign. The data is small typed arrays, so it can be cached in
   the browser (roomCache.js) and turned back into a far layer with farLayer() without building the room. */

/* ---------- round shapes with fewer sides: nobody can tell from far away ---------- */
const LOW = new WeakMap();
function lowPoly(g) {
  if (LOW.has(g)) return LOW.get(g);
  const p = g.parameters, m = Math.min;
  let lo = g;
  if (p) switch (g.type) {
    case 'SphereGeometry': lo = new THREE.SphereGeometry(p.radius, m(p.widthSegments, 10), m(p.heightSegments, 7), p.phiStart, p.phiLength, p.thetaStart, p.thetaLength); break;
    case 'CylinderGeometry': lo = new THREE.CylinderGeometry(p.radiusTop, p.radiusBottom, p.height, m(p.radialSegments, 10), 1, p.openEnded, p.thetaStart, p.thetaLength); break;
    case 'ConeGeometry': lo = new THREE.ConeGeometry(p.radius, p.height, m(p.radialSegments, 10), 1, p.openEnded, p.thetaStart, p.thetaLength); break;
    case 'TorusGeometry': lo = new THREE.TorusGeometry(p.radius, p.tube, m(p.radialSegments, 5), m(p.tubularSegments, 14), p.arc); break;
    case 'CircleGeometry': lo = new THREE.CircleGeometry(p.radius, m(p.segments, 12), p.thetaStart, p.thetaLength); break;
    case 'TubeGeometry': lo = new THREE.TubeGeometry(p.path, m(p.tubularSegments, 16), p.radius, m(p.radialSegments, 4), p.closed); break;
    case 'LatheGeometry': lo = new THREE.LatheGeometry(p.points, m(p.segments, 10), p.phiStart, p.phiLength); break;
  }
  LOW.set(g, lo); return lo;
}

/* ---------- average colour of each picture ---------- */
// 64 pixels from each (no smoothing: much faster, close enough), all of a room's pictures drawn into one strip
// so the page reads pixels back only once per room
const probe = document.createElement('canvas'), pctx = probe.getContext('2d', { willReadFrequently: true });
const avgCache = new WeakMap();
function averageColors(texes) {
  const todo = [...new Set(texes)].filter(t => !avgCache.has(t));
  if (!todo.length) return;
  probe.width = 8; probe.height = 8 * todo.length;   // resizing also clears it
  pctx.imageSmoothingEnabled = false;
  todo.forEach((t, i) => { try { pctx.drawImage(t.image, 0, i * 8, 8, 8); } catch { /* not ready: stays empty */ } });
  let d = null; try { d = pctx.getImageData(0, 0, 8, probe.height).data; } catch { /* unreadable image */ }
  todo.forEach((t, i) => {
    let r = 0, g = 0, b = 0, a = 0;
    if (d) for (let p = i * 256; p < (i + 1) * 256; p += 4) { const w = d[p + 3]; r += d[p] * w; g += d[p + 1] * w; b += d[p + 2] * w; a += w; }
    avgCache.set(t, a ? new THREE.Color().setRGB(r / a / 255, g / a / 255, b / a / 255, THREE.SRGBColorSpace) : null);
  });
}
const seeThrough = m => !m || m.visible === false || m.transparent || m.opacity < 1 || m.alphaTest > 0 || m.blending !== THREE.NormalBlending;
function colorOf(m) {
  const c = m.color ? m.color.clone() : new THREE.Color(1, 1, 1);
  if (m.map) { const a = avgCache.get(m.map); if (a) c.multiply(a); }
  const glowing = m.emissive && m.emissiveIntensity > 0.3 && m.emissive.getHex() !== 0;
  if (glowing) c.copy(m.emissive);
  return { c, flat: !!m.isMeshBasicMaterial || glowing };
}

// read the average colours of a built room's pictures ahead of baking (the slow part of a bake, about 5 ms),
// so building a new room can be split into small steps
export function sampleColors(group) {
  const maps = [];
  group.traverse(o => { if (o.isMesh && o.visible) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m?.map?.image && !seeThrough(m)) maps.push(m.map); }); });
  averageColors(maps);
}

/* ---------- bake: a built room -> plain data ---------- */
const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _nm = new THREE.Matrix3(), _rel = new THREE.Matrix4();
// merge [geometry, matrix, per-vertex colour array] items into one set of typed arrays
function pack(items) {
  if (!items.length) return null;
  let nv = 0, ni = 0;
  for (const it of items) { nv += it.geo.attributes.position.count; ni += it.geo.index ? it.geo.index.count : it.geo.attributes.position.count; }
  const p = new Float32Array(nv * 3), n = new Int8Array(nv * 3), c = new Uint8Array(nv * 3), idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let vb = 0, ib = 0;
  for (const { geo, m, col } of items) {
    const pos = geo.attributes.position, nor = geo.attributes.normal, cnt = pos.count;
    _nm.getNormalMatrix(m);
    for (let i = 0; i < cnt; i++) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(m); _v.toArray(p, (vb + i) * 3);
      if (nor) _n.fromBufferAttribute(nor, i).applyMatrix3(_nm).normalize(); else _n.set(0, 1, 0);
      n[(vb + i) * 3] = Math.round(_n.x * 127); n[(vb + i) * 3 + 1] = Math.round(_n.y * 127); n[(vb + i) * 3 + 2] = Math.round(_n.z * 127);
    }
    c.set(col, vb * 3);
    if (geo.index) { const src = geo.index.array; for (let i = 0; i < src.length; i++) idx[ib + i] = src[i] + vb; ib += src.length; }
    else { for (let i = 0; i < cnt; i++) idx[ib + i] = vb + i; ib += cnt; }
    vb += cnt;
  }
  return { p, n, c, i: idx };
}
// lamp glows and the name sign can't be merged (they're see-through), so they're kept as a small list
function glowRecord(o, rel, tex) {
  const m = o.material, name = Object.keys(tex).find(k => tex[k] === m.map);
  if (!name || m.blending !== THREE.AdditiveBlending) return null;
  const r = { tex: name, c: m.color.getHex(), o: m.opacity, m: Array.from(rel.elements) };
  if (o.isSprite) return { ...r, k: 's' };
  const gp = o.geometry.parameters;
  return o.geometry.type === 'PlaneGeometry' ? { ...r, k: 'p', w: gp.width, h: gp.height } : null;
}
export function bakeRoom(group) {
  group.updateMatrixWorld(true);
  const toLocal = group.matrixWorld.clone().invert(), tex = lightTextures();
  const solid = [], glows = []; let sign = null;
  group.traverse(o => {
    if (!(o.isMesh || o.isSprite) || !o.visible) return;
    const rel = new THREE.Matrix4().multiplyMatrices(toLocal, o.matrixWorld);
    if (o.userData.sign) { const gp = o.geometry.parameters; sign = { w: gp.width, h: gp.height, m: Array.from(rel.elements) }; return; }
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (o.isSprite || mats.some(seeThrough)) { const g = glowRecord(o, rel, tex); if (g) glows.push(g); return; }   // glass, nets: left out
    if (o.geometry?.attributes.position) solid.push({ o, mats, rel });
  });
  averageColors(solid.flatMap(s => s.mats.map(m => m.map).filter(t => t?.image)));
  const lit = [], flat = [];
  for (const { o, mats, rel } of solid) {
    const src = o.geometry, geo = Array.isArray(o.material) ? src : lowPoly(src);   // multi-material shapes keep their sides
    const cnt = geo.attributes.position.count, col = new Uint8Array(cnt * 3), idx = geo.index?.array;
    const ranges = Array.isArray(o.material) && geo.groups.length ? geo.groups : [{ start: 0, count: idx ? idx.length : cnt, materialIndex: 0 }];
    let isFlat = false;
    for (const r of ranges) {
      const { c, flat: f } = colorOf(mats[r.materialIndex] || mats[0]); isFlat ||= f;
      const R = Math.round(Math.min(1, c.r) * 255), G = Math.round(Math.min(1, c.g) * 255), B = Math.round(Math.min(1, c.b) * 255);
      for (let i = r.start; i < Math.min(idx ? idx.length : cnt, r.start + r.count); i++) { const v = (idx ? idx[i] : i) * 3; col[v] = R; col[v + 1] = G; col[v + 2] = B; }
    }
    (isFlat ? flat : lit).push({ geo, m: rel, col });
  }
  return { lit: pack(lit), flat: pack(flat), glows, sign };
}

/* ---------- far layer: data -> meshes ---------- */
const noRay = () => {};   // the far layer is never clicked: hover and clicks go to the real room
function bakedMesh(d, material) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(d.p, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(d.n, 3, true));
  g.setAttribute('color', new THREE.BufferAttribute(d.c, 3, true));
  g.setIndex(new THREE.BufferAttribute(d.i, 1));
  g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, material); mesh.raycast = noRay; mesh.matrixAutoUpdate = false; return mesh;
}
export function farLayer(data, room, fontsReady) {
  const far = new THREE.Group(); far.name = 'far';
  if (data.lit) far.add(bakedMesh(data.lit, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide })));
  if (data.flat) far.add(bakedMesh(data.flat, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: THREE.DoubleSide })));
  const tex = lightTextures();
  for (const r of data.glows) {
    const opts = { map: tex[r.tex], color: r.c, transparent: true, opacity: r.o, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false };
    const o = r.k === 's' ? new THREE.Sprite(new THREE.SpriteMaterial(opts)) : new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.h), new THREE.MeshBasicMaterial(opts));
    o.matrix.fromArray(r.m); o.matrixAutoUpdate = false; o.raycast = noRay; far.add(o);
  }
  if (data.sign) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(data.sign.w, data.sign.h), neonSign(room.title, room.color, fontsReady ? '"Chakra Petch"' : 'system-ui'));
    s.matrix.fromArray(data.sign.m); s.matrixAutoUpdate = false; s.raycast = noRay; far.add(s);
  }
  return far;
}
