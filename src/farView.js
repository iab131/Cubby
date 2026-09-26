import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/* A far-away room in a handful of draw calls instead of hundreds. Every solid piece is baked into one mesh
   with its colour painted on the corners: lit pieces in one mesh, glowing/unlit ones in another. Pictures
   and signs use their texture's average colour. Lamp glows are kept as they are. */

// average colour of each picture: 64 pixels from each (no smoothing: much faster, close enough),
// all of a room's pictures drawn into one strip so the page reads pixels back only once per room
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
const avgColor = tex => avgCache.get(tex) || null;
const seeThrough = m => !m || m.visible === false || m.transparent || m.opacity < 1 || m.alphaTest > 0 || m.blending !== THREE.NormalBlending;
function colorOf(m) {
  const c = m.color ? m.color.clone() : new THREE.Color(1, 1, 1);
  if (m.map) { const a = avgColor(m.map); if (a) c.multiply(a); }
  const glowing = m.emissive && m.emissiveIntensity > 0.3 && m.emissive.getHex() !== 0;
  if (glowing) c.copy(m.emissive);
  return { c, flat: !!m.isMeshBasicMaterial || glowing };
}

// bake the solid meshes under `group`; returns the far mesh (hidden) and the children it stands in for
export function buildFarView(group) {
  group.updateMatrixWorld(true);
  const toLocal = group.matrixWorld.clone().invert(), rel = new THREE.Matrix4();
  const meshes = [];
  group.traverse(o => {
    if (!o.isMesh || !o.visible || !o.geometry?.attributes.position) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!mats.some(seeThrough)) meshes.push([o, mats]);
  });
  averageColors(meshes.flatMap(([, mats]) => mats.map(m => m.map).filter(t => t?.image)));
  const lit = [], flat = [], baked = new Set();
  meshes.forEach(([o, mats]) => {
    const src = o.geometry;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', src.attributes.position.clone());
    if (src.attributes.normal) geo.setAttribute('normal', src.attributes.normal.clone()); else geo.computeVertexNormals();
    const n = geo.attributes.position.count;
    geo.setIndex(src.index ? src.index.clone() : [...Array(n).keys()]);
    // colour every corner by the material of the face it belongs to
    const col = new Float32Array(n * 3), idx = geo.index.array;
    const ranges = Array.isArray(o.material) && src.groups.length ? src.groups : [{ start: 0, count: idx.length, materialIndex: 0 }];
    let isFlat = false;
    for (const r of ranges) {
      const { c, flat: f } = colorOf(mats[r.materialIndex] || mats[0]); isFlat ||= f;
      for (let i = r.start; i < Math.min(idx.length, r.start + r.count); i++) c.toArray(col, idx[i] * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.applyMatrix4(rel.multiplyMatrices(toLocal, o.matrixWorld));
    (isFlat ? flat : lit).push(geo); baked.add(o);
  });
  const far = new THREE.Group(); far.visible = false; far.name = 'far-view';
  const litGeo = lit.length ? mergeGeometries(lit) : null, flatGeo = flat.length ? mergeGeometries(flat) : null;
  if (litGeo) far.add(new THREE.Mesh(litGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide })));
  if (flatGeo) far.add(new THREE.Mesh(flatGeo, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: THREE.DoubleSide })));
  // the baked copy sits exactly on top of the real room, and three's raycaster doesn't skip hidden things:
  // left clickable, it would steal hover and clicks from the real objects
  far.children.forEach(m => { m.raycast = () => {}; });
  [...lit, ...flat].forEach(g => g.dispose());
  group.add(far);
  if (!far.children.length) return { far, hide: [] };   // nothing could be baked: keep drawing the room as it is
  // what to hide when far: everything the bake stands in for, and small see-through bits (glass, nets).
  // Lamp glows stay (a few cheap additive planes that keep the room warm), and so does the neon name sign.
  const hide = [];
  group.traverse(o => {
    if (!(o.isMesh || o.isSprite) || !o.visible || o.parent === far) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    const keep = !baked.has(o) && (m?.blending === THREE.AdditiveBlending || o.parent === group);
    if (!keep) hide.push(o);
  });
  return { far, hide };
}

export function setFar(view, on) {
  view.far.visible = on;
  view.hide.forEach(c => { c.visible = !on; });
}
