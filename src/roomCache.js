/* The browser's own cache of baked rooms (IndexedDB), so a return visit shows every room's far version
   without building or baking anything. An entry is keyed by the room code and by a fingerprint of the code
   that builds rooms (set in vite.config.js), so changing either one makes a fresh bake.
   Off in dev, where the room-building files change while you work. Every call fails soft: no cache just
   means the same rooms, a little slower. */
const ON = !import.meta.env.DEV && typeof indexedDB !== 'undefined';
const BUILD = typeof __ROOM_BUILD__ !== 'undefined' ? __ROOM_BUILD__ : 'dev';
const STORE = 'far';

let dbp = null;
function db() {
  return dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open('cubby-rooms', 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error('blocked'));
  });
}
const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

// FNV-1a, twice with different seeds: a 64-bit key, plenty for a few thousand rooms
function hash(s) {
  let a = 0x811c9dc5, b = 0x01000193 ^ s.length;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b ^ c, 2246822519); }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36);
}
export const cacheKey = (owner, sig) => `${BUILD}:${owner}:${hash(sig)}`;

export async function readMany(keys) {
  const out = new Map();
  if (!ON || !keys.length) return out;
  try {
    const st = (await db()).transaction(STORE, 'readonly').objectStore(STORE);
    const vals = await Promise.all(keys.map(k => req(st.get(k)).catch(() => undefined)));
    keys.forEach((k, i) => { if (vals[i]) out.set(k, vals[i]); });
  } catch { /* no cache */ }
  return out;
}
export async function write(key, data) {
  if (!ON) return;
  try { (await db()).transaction(STORE, 'readwrite').objectStore(STORE).put(data, key); } catch { /* full or blocked: skip */ }
}
// forget rooms that changed or left the grid, so the cache never grows past the grid itself
export async function keepOnly(keys) {
  if (!ON) return;
  try {
    const keep = new Set(keys), st = (await db()).transaction(STORE, 'readwrite').objectStore(STORE);
    for (const k of await req(st.getAllKeys())) if (!keep.has(k)) st.delete(k);
  } catch { /* skip */ }
}
