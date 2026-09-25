import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export const mat = (color, rough = 0.75, metal = 0, extra = {}) =>
  new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: metal }, extra));

export function box(w, h, d, m, x, y, z, parent, r = 0) {
  const g = r > 0 ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d);
  const o = new THREE.Mesh(g, m); o.position.set(x, y, z); parent.add(o); return o;
}
export function cyl(rt, rb, h, m, x, y, z, parent, seg = 24, open = false) {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), m); o.position.set(x, y, z); parent.add(o); return o;
}
export function sph(r, m, x, y, z, parent, seg = 24) {
  const o = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7)), m); o.position.set(x, y, z); parent.add(o); return o;
}
export function plane(w, h, m, x, y, z, parent) {
  const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); o.position.set(x, y, z); parent.add(o); return o;
}
export function torus(r, t, m, x, y, z, parent, seg = 40, arc = Math.PI * 2) {
  const o = new THREE.Mesh(new THREE.TorusGeometry(r, t, 10, seg, arc), m); o.position.set(x, y, z); parent.add(o); return o;
}
export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  if (draw) draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return { t, c, ctx };
}
export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
export function rand(seed) { let s = Math.max(1, Math.floor(seed) % 2147483647); return () => (s = (s * 16807) % 2147483647) / 2147483647; }
export function hashStr(str) { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return Math.abs(h) || 1; }
export const screenMat = tex => new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
export const glowMat = color => new THREE.MeshBasicMaterial({ color, toneMapped: false });
